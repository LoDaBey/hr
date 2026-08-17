import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { requireHr } from '@/lib/auth-hr';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import { enqueueCommunication } from '@/lib/repos/communications';
import type { HrFinalDecisionResult, HrFinalDecisionValue } from '@/types/api';
import type { Stage, Status } from '@/types/domain';

export const dynamic = 'force-dynamic';

const DECISIONS = [
  'HIRED',
  'OFFER_PENDING',
  'SECOND_FINAL_INTERVIEW',
  'HOLD',
  'FINAL_REJECTED',
] as const satisfies readonly HrFinalDecisionValue[];

const bodySchema = z.object({
  decision: z.enum(DECISIONS),
  note: z.string().optional(),
  confirm: z.string().optional(),
});

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

function stageFor(decision: HrFinalDecisionValue): Stage {
  if (decision === 'HIRED') return 'HIRED';
  if (decision === 'OFFER_PENDING') return 'OFFER_PENDING';
  if (decision === 'SECOND_FINAL_INTERVIEW') return 'SECOND_FINAL_INTERVIEW';
  if (decision === 'FINAL_REJECTED') return 'FINAL_REJECTED';
  return 'FINAL_INTERVIEW_COMPLETED';
}

function statusFor(decision: HrFinalDecisionValue): Status {
  if (decision === 'HIRED') return 'HIRED';
  if (decision === 'FINAL_REJECTED') return 'REJECTED';
  if (decision === 'HOLD') return 'ON_HOLD';
  return 'ACTIVE';
}

export async function POST(
  req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  const { applicationId } = await context.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION_FAILED', 'Validation failed', {
      fields: [
        ...new Set(parsed.error.issues.map((i) => i.path.join('.')).filter(Boolean)),
      ],
    });
  }

  const { decision, note, confirm } = parsed.data;

  try {
    const result = await tx(async (client) => {
      const application = await oneTx<{
        id: string;
        stage: Stage;
        candidate_id: string;
        job_id: string;
        email: string;
        full_name: string;
        title: string;
      }>(
        client,
        `SELECT a.id, a.stage, a.candidate_id, a.job_id, c.email, c.full_name, j.title
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN jobs j ON j.id = a.job_id
         WHERE a.id = $1
         FOR UPDATE OF a`,
        [applicationId],
      );

      if (!application) return { kind: 'not_found' as const };
      if (application.stage !== 'FINAL_INTERVIEW_COMPLETED') {
        return { kind: 'wrong_stage' as const };
      }

      if (decision === 'HIRED') {
        const ok =
          confirm?.trim().toUpperCase() === 'HIRED' ||
          confirm?.trim().toLowerCase() === application.full_name.trim().toLowerCase();
        if (!ok) {
          return { kind: 'confirm' as const };
        }
      }

      const nextStage = stageFor(decision);
      const nextStatus = statusFor(decision);

      await client.query(
        `UPDATE applications
         SET stage = $2::app_stage,
             status = $3::app_status,
             reject_reason = CASE WHEN $4 = 'FINAL_REJECTED' THEN $5 ELSE reject_reason END,
             hold_reason = CASE WHEN $4 = 'HOLD' THEN $5 ELSE hold_reason END,
             updated_at = now()
         WHERE id = $1`,
        [applicationId, nextStage, nextStatus, decision, note ?? null],
      );

      await client.query(
        `INSERT INTO recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_id, actor_label, payload
         ) VALUES (
           $1, $2, $3, 'FINAL_DECISION',
           'FINAL_INTERVIEW_COMPLETED'::app_stage, $4::app_stage,
           'HR', $5, $6, $7::jsonb
         )`,
        [
          applicationId,
          application.candidate_id,
          application.job_id,
          nextStage,
          user.id,
          user.name,
          JSON.stringify({ decision, note: note ?? null }),
        ],
      );

      return {
        kind: 'ok' as const,
        application,
        data: { stage: nextStage, status: nextStatus } satisfies HrFinalDecisionResult,
      };
    });

    if (result.kind === 'not_found') {
      return jsonError(404, 'NOT_FOUND', 'Application not found');
    }
    if (result.kind === 'wrong_stage') {
      return jsonError(409, 'WRONG_STAGE', 'Final decision is not available at this stage');
    }
    if (result.kind === 'confirm') {
      return jsonError(400, 'VALIDATION_FAILED', 'Type HIRED or the candidate name to confirm', {
        fields: ['confirm'],
      });
    }

    const { application, data } = result;

    if (decision === 'HIRED') {
      await enqueueCommunication({
        candidate_id: application.candidate_id,
        application_id: applicationId,
        template_key: 'HIRED',
        to_email: application.email,
        variables: {
          candidate_name: application.full_name,
          job_title: application.title,
          hr_name: user.name,
        },
        dedupe_key: `${applicationId}:HIRED:v1`,
      });
    } else if (decision === 'OFFER_PENDING') {
      await enqueueCommunication({
        candidate_id: application.candidate_id,
        application_id: applicationId,
        template_key: 'OFFER',
        to_email: application.email,
        variables: {
          candidate_name: application.full_name,
          job_title: application.title,
          hr_name: user.name,
        },
        dedupe_key: `${applicationId}:OFFER:v1`,
      });
    } else if (decision === 'FINAL_REJECTED') {
      await enqueueCommunication({
        candidate_id: application.candidate_id,
        application_id: applicationId,
        template_key: 'REJECTION',
        to_email: application.email,
        variables: {
          candidate_name: application.full_name,
          job_title: application.title,
          hr_name: user.name,
          note: note ?? '',
        },
        dedupe_key: `${applicationId}:FINAL_REJECTION:v1`,
      });
    }

    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to apply final decision');
  }
}
