import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { tx } from '@/lib/db';
import {
  auditAutoInviteSkipped,
  issueInvite,
  type InviteActor,
} from '@/lib/pipeline/invites';
import { enqueueCommunication } from '@/lib/repos/communications';
import { getAppSettings } from '@/lib/repos/app-settings';
import type { HrDecisionResult } from '@/types/api';
import type { Stage, Status } from '@/types/domain';

export const dynamic = 'force-dynamic';

const DECISIONS = [
  'SHORTLIST',
  'REJECT',
  'HOLD',
  'REQUEST_INFO',
  'ADDITIONAL_INTERVIEW',
  'WITHDRAW',
] as const;

const STAGE_MAP: Partial<
  Record<Stage, Partial<Record<(typeof DECISIONS)[number], Stage>>>
> = {
  INITIAL_SCREENING_REVIEW: {
    SHORTLIST: 'INITIAL_SHORTLISTED',
    REJECT: 'INITIAL_REJECTED',
  },
  TECH_ASSESSMENT_REVIEW: {
    SHORTLIST: 'TECH_SHORTLISTED',
    REJECT: 'TECH_REJECTED',
  },
  RECORDED_TECH_REVIEW: {
    SHORTLIST: 'RECORDED_TECH_SHORTLISTED',
    REJECT: 'RECORDED_TECH_REJECTED',
    ADDITIONAL_INTERVIEW: 'FINAL_INTERVIEW_PENDING',
  },
};

const bodySchema = z.object({
  decision: z.enum(DECISIONS),
  note: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  expected_stage: z.string().min(1),
});

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

function resolveNextStage(
  decision: (typeof DECISIONS)[number],
  expectedStage: Stage,
): Stage | null {
  if (decision === 'SHORTLIST' || decision === 'REJECT' || decision === 'ADDITIONAL_INTERVIEW') {
    const mapped = STAGE_MAP[expectedStage]?.[decision];
    return mapped ?? null;
  }
  return expectedStage;
}

async function tryAutoInvite(
  client: PoolClient,
  input: {
    applicationId: string;
    candidateId: string;
    jobId: string;
    stageAfterDecision: Stage;
    kind: 'ASSESSMENT' | 'TECH_TEST';
    delayMinutes: number;
    actor: InviteActor;
  },
): Promise<void> {
  await client.query('SAVEPOINT auto_invite');
  try {
    const sendAt = new Date(Date.now() + input.delayMinutes * 60_000);
    const result = await issueInvite(input.applicationId, {
      kind: input.kind,
      sendAt,
      actor: input.actor,
      client,
      autoScheduled: true,
    });

    if (!result.ok && result.reason === 'no_assessment') {
      await auditAutoInviteSkipped(client, {
        applicationId: input.applicationId,
        candidateId: input.candidateId,
        jobId: input.jobId,
        stage: input.stageAfterDecision,
        kind: input.kind,
        reason:
          input.kind === 'ASSESSMENT'
            ? 'No assessment configured for this job'
            : 'No recorded tech test configured for this job',
        actor: input.actor,
      });
    }

    await client.query('RELEASE SAVEPOINT auto_invite');
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT auto_invite');
    const message = error instanceof Error ? error.message : 'Auto-invite failed';
    console.error('auto-invite failed', error);
    await client.query(
      `INSERT INTO HRSYSTEM_workflow_errors (
         action, node, error_message, application_id, candidate_id, input_ref
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        'hr.decision.auto_invite',
        input.kind,
        message,
        input.applicationId,
        input.candidateId,
        JSON.stringify({ kind: input.kind }),
      ],
    );
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
    ];
    return jsonError(400, 'VALIDATION_FAILED', 'Validation failed', { fields });
  }

  const { applicationId } = await context.params;
  const decision = parsed.data.decision;
  const expectedStage = parsed.data.expected_stage as Stage;
  const reason = parsed.data.reason ?? parsed.data.note ?? null;
  const nextStage = resolveNextStage(decision, expectedStage);

  if (!nextStage) {
    return jsonError(400, 'VALIDATION_FAILED', 'Decision is not allowed at this stage', {
      fields: ['decision'],
    });
  }

  // SHORTLIST at recorded review: land on SHORTLISTED then PENDING in one transaction.
  const finalStage: Stage =
    expectedStage === 'RECORDED_TECH_REVIEW' && decision === 'SHORTLIST'
      ? 'FINAL_INTERVIEW_PENDING'
      : nextStage;

  const actor: InviteActor = { type: 'HR', id: user.id, label: user.name };

  try {
    const result = await tx(async (client) => {
      const row = await oneTx<{
        id: string;
        stage: Stage;
        status: Status;
        candidate_id: string;
        job_id: string;
        email: string;
        full_name: string;
        title: string;
      }>(
        client,
        `UPDATE HRSYSTEM_applications a
         SET stage = $2::HRSYSTEM_app_stage,
             status = CASE WHEN $3 = 'REJECT' THEN 'REJECTED'::HRSYSTEM_app_status
                           WHEN $3 = 'HOLD' THEN 'ON_HOLD'::HRSYSTEM_app_status
                           WHEN $3 = 'WITHDRAW' THEN 'WITHDRAWN'::HRSYSTEM_app_status
                           ELSE 'ACTIVE'::HRSYSTEM_app_status END,
             reject_reason = CASE WHEN $3 = 'REJECT' THEN $4 ELSE reject_reason END,
             hold_reason = CASE WHEN $3 = 'HOLD' THEN $4 ELSE hold_reason END,
             updated_at = now()
         FROM HRSYSTEM_candidates c, HRSYSTEM_jobs j
         WHERE a.id = $1
           AND a.stage = $5::HRSYSTEM_app_stage
           AND c.id = a.candidate_id
           AND j.id = a.job_id
         RETURNING a.id, a.stage, a.status, a.candidate_id, a.job_id,
                   c.email, c.full_name, j.title`,
        [applicationId, finalStage, decision, reason, expectedStage],
      );

      if (!row) {
        return { conflict: true as const };
      }

      if (expectedStage === 'INITIAL_SCREENING_REVIEW') {
        await client.query(
          `UPDATE HRSYSTEM_screening_results SET
             hr_decision = $2,
             hr_override_reason = $3,
             hr_user_id = $4,
             hr_decided_at = now()
           WHERE id = (
             SELECT id FROM HRSYSTEM_screening_results
             WHERE application_id = $1
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [applicationId, decision, reason, user.id],
        );
      }

      if (expectedStage === 'TECH_ASSESSMENT_REVIEW') {
        await client.query(
          `UPDATE HRSYSTEM_candidate_assessments SET
             hr_decision = $2,
             hr_user_id = $3,
             hr_decided_at = now(),
             updated_at = now()
           WHERE id = (
             SELECT id FROM HRSYSTEM_candidate_assessments
             WHERE application_id = $1 AND kind = 'ASSESSMENT' AND status <> 'CANCELLED'
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [applicationId, decision, user.id],
        );
      }

      if (expectedStage === 'RECORDED_TECH_REVIEW') {
        await client.query(
          `UPDATE HRSYSTEM_candidate_assessments SET
             hr_decision = $2,
             hr_user_id = $3,
             hr_decided_at = now(),
             updated_at = now()
           WHERE id = (
             SELECT id FROM HRSYSTEM_candidate_assessments
             WHERE application_id = $1 AND kind = 'TECH_TEST' AND status <> 'CANCELLED'
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [applicationId, decision, user.id],
        );

        // Audit the intermediate shortlist stage when we jumped to FINAL_INTERVIEW_PENDING.
        if (decision === 'SHORTLIST') {
          await client.query(
            `INSERT INTO HRSYSTEM_recruitment_events (
               application_id, candidate_id, job_id, event_type,
               from_stage, to_stage, actor_type, actor_id, actor_label, payload
             ) VALUES (
               $1, $2, $3, 'HR_DECISION',
               $4::HRSYSTEM_app_stage, 'RECORDED_TECH_SHORTLISTED'::HRSYSTEM_app_stage,
               'HR', $5, $6, $7::jsonb
             )`,
            [
              applicationId,
              row.candidate_id,
              row.job_id,
              expectedStage,
              user.id,
              user.name,
              JSON.stringify({ decision, note: parsed.data.note ?? null, reason, hop: 1 }),
            ],
          );
        }
      }

      await client.query(
        `INSERT INTO HRSYSTEM_recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_id, actor_label, payload
         ) VALUES ($1, $2, $3, 'HR_DECISION', $4::HRSYSTEM_app_stage, $5::HRSYSTEM_app_stage, 'HR', $6, $7, $8::jsonb)`,
        [
          applicationId,
          row.candidate_id,
          row.job_id,
          decision === 'SHORTLIST' && expectedStage === 'RECORDED_TECH_REVIEW'
            ? 'RECORDED_TECH_SHORTLISTED'
            : expectedStage,
          row.stage,
          user.id,
          user.name,
          JSON.stringify({ decision, note: parsed.data.note ?? null, reason }),
        ],
      );

      // Auto-invite after shortlist (never fails the decision).
      if (decision === 'SHORTLIST') {
        const settings = await getAppSettings(client);

        if (
          expectedStage === 'INITIAL_SCREENING_REVIEW' &&
          settings.auto_send_assessment
        ) {
          await tryAutoInvite(client, {
            applicationId,
            candidateId: row.candidate_id,
            jobId: row.job_id,
            stageAfterDecision: 'INITIAL_SHORTLISTED',
            kind: 'ASSESSMENT',
            delayMinutes: settings.auto_send_assessment_delay_minutes,
            actor,
          });
          // Stage may have moved to TECH_ASSESSMENT_SENT inside the savepoint.
          const refreshed = await oneTx<{ stage: Stage; status: Status }>(
            client,
            `SELECT stage, status FROM HRSYSTEM_applications WHERE id = $1`,
            [applicationId],
          );
          if (refreshed) {
            row.stage = refreshed.stage;
            row.status = refreshed.status;
          }
        }

        if (
          expectedStage === 'TECH_ASSESSMENT_REVIEW' &&
          settings.auto_send_techtest
        ) {
          await tryAutoInvite(client, {
            applicationId,
            candidateId: row.candidate_id,
            jobId: row.job_id,
            stageAfterDecision: 'TECH_SHORTLISTED',
            kind: 'TECH_TEST',
            delayMinutes: settings.auto_send_techtest_delay_minutes,
            actor,
          });
          const refreshed = await oneTx<{ stage: Stage; status: Status }>(
            client,
            `SELECT stage, status FROM HRSYSTEM_applications WHERE id = $1`,
            [applicationId],
          );
          if (refreshed) {
            row.stage = refreshed.stage;
            row.status = refreshed.status;
          }
        }
      }

      return { conflict: false as const, row };
    });

    if (result.conflict) {
      return jsonError(409, 'WRONG_STAGE', 'Application is not in the expected stage');
    }

    const { row } = result;
    if (decision === 'REJECT') {
      await enqueueCommunication({
        candidate_id: row.candidate_id,
        application_id: row.id,
        template_key: 'REJECTION',
        to_email: row.email,
        variables: {
          candidate_name: row.full_name,
          job_title: row.title,
          hr_name: user.name,
        },
        dedupe_key: `${row.id}:REJECTION:v1`,
      });
    } else if (decision === 'SHORTLIST' && expectedStage === 'INITIAL_SCREENING_REVIEW') {
      await enqueueCommunication({
        candidate_id: row.candidate_id,
        application_id: row.id,
        template_key: 'INITIAL_SHORTLIST',
        to_email: row.email,
        variables: {
          candidate_name: row.full_name,
          job_title: row.title,
          hr_name: user.name,
        },
        dedupe_key: `${row.id}:INITIAL_SHORTLIST:v1`,
      });
    }

    const data: HrDecisionResult = { stage: row.stage, status: row.status };
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to apply decision');
  }
}
