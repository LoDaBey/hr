import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { requireHr } from '@/lib/auth-hr';
import { tx } from '@/lib/db';
import { datetime } from '@/lib/format';
import { jsonError, jsonOk } from '@/lib/http';
import { enqueueCommunication } from '@/lib/repos/communications';
import type { HrInterviewScheduleResult } from '@/types/api';
import type { Stage } from '@/types/domain';

export const dynamic = 'force-dynamic';

const SCHEDULE_STAGES: Stage[] = [
  'FINAL_INTERVIEW_PENDING',
  'FINAL_INTERVIEW_SCHEDULED',
  'SECOND_FINAL_INTERVIEW',
];

const bodySchema = z.object({
  round_no: z.number().int().positive().default(1),
  scheduled_at: z.string().min(1),
  timezone: z.string().min(1),
  duration_minutes: z.number().int().positive().default(45),
  interviewer_name: z.string().optional(),
  interviewer_email: z.string().email().optional().or(z.literal('')),
  meeting_url: z.string().url().optional().or(z.literal('')),
});

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
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

  const scheduledAt = new Date(parsed.data.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return jsonError(400, 'VALIDATION_FAILED', 'scheduled_at must be in the future', {
      fields: ['scheduled_at'],
    });
  }

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
         FROM HRSYSTEM_applications a
         JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
         JOIN HRSYSTEM_jobs j ON j.id = a.job_id
         WHERE a.id = $1
         FOR UPDATE OF a`,
        [applicationId],
      );

      if (!application) return { kind: 'not_found' as const };
      if (!SCHEDULE_STAGES.includes(application.stage)) {
        return { kind: 'wrong_stage' as const };
      }

      const roundNo =
        application.stage === 'SECOND_FINAL_INTERVIEW'
          ? Math.max(2, parsed.data.round_no)
          : parsed.data.round_no;

      const interview = await oneTx<{ id: string }>(
        client,
        `INSERT INTO HRSYSTEM_interviews (
           application_id, round_no, scheduled_at, timezone, duration_minutes,
           interviewer_name, interviewer_email, meeting_url, created_by
         )
         VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (application_id, round_no) DO UPDATE SET
           scheduled_at = EXCLUDED.scheduled_at,
           timezone = EXCLUDED.timezone,
           duration_minutes = EXCLUDED.duration_minutes,
           interviewer_name = EXCLUDED.interviewer_name,
           interviewer_email = EXCLUDED.interviewer_email,
           meeting_url = EXCLUDED.meeting_url,
           reminder_24h_sent_at = NULL,
           reminder_2h_sent_at = NULL,
           status = 'SCHEDULED',
           updated_at = now()
         RETURNING id`,
        [
          applicationId,
          roundNo,
          scheduledAt.toISOString(),
          parsed.data.timezone,
          parsed.data.duration_minutes,
          parsed.data.interviewer_name || null,
          parsed.data.interviewer_email || null,
          parsed.data.meeting_url || null,
          user.id,
        ],
      );

      if (!interview) return { kind: 'error' as const };

      const fromStage = application.stage;
      await client.query(
        `UPDATE HRSYSTEM_applications
         SET stage = 'FINAL_INTERVIEW_SCHEDULED'::HRSYSTEM_app_stage, updated_at = now()
         WHERE id = $1`,
        [applicationId],
      );

      await client.query(
        `INSERT INTO HRSYSTEM_recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_id, actor_label, payload
         ) VALUES (
           $1, $2, $3, 'INTERVIEW_SCHEDULED',
           $4::HRSYSTEM_app_stage, 'FINAL_INTERVIEW_SCHEDULED'::HRSYSTEM_app_stage,
           'HR', $5, $6, $7::jsonb
         )`,
        [
          applicationId,
          application.candidate_id,
          application.job_id,
          fromStage,
          user.id,
          user.name,
          JSON.stringify({ interview_id: interview.id, round_no: roundNo }),
        ],
      );

      const whenLocal = scheduledAt.toLocaleString('en-GB', {
        timeZone: parsed.data.timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const [datePart, timePart] = whenLocal.split(', ');

      return {
        kind: 'ok' as const,
        application,
        interviewId: interview.id,
        emailVars: {
          candidate_name: application.full_name,
          job_title: application.title,
          interview_date: datePart ?? datetime(scheduledAt.toISOString()),
          interview_time: timePart ?? '',
          timezone: parsed.data.timezone,
          meeting_url: parsed.data.meeting_url || '',
          hr_name: user.name,
        },
        dedupe_key: `${applicationId}:INTERVIEW_INVITE:${interview.id}:${scheduledAt.toISOString()}`,
        data: {
          interview_id: interview.id,
          stage: 'FINAL_INTERVIEW_SCHEDULED' as Stage,
        } satisfies HrInterviewScheduleResult,
      };
    });

    if (result.kind === 'not_found') {
      return jsonError(404, 'NOT_FOUND', 'Application not found');
    }
    if (result.kind === 'wrong_stage') {
      return jsonError(409, 'WRONG_STAGE', 'Cannot schedule interview at this stage');
    }
    if (result.kind !== 'ok') {
      return jsonError(500, 'INTERNAL_ERROR', 'Failed to schedule interview');
    }

    await enqueueCommunication({
      candidate_id: result.application.candidate_id,
      application_id: applicationId,
      template_key: 'INTERVIEW_INVITE',
      to_email: result.application.email,
      variables: result.emailVars,
      dedupe_key: result.dedupe_key,
    });

    return jsonOk(result.data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to schedule interview');
  }
}
