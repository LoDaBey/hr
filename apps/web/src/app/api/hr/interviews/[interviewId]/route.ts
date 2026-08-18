import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { requireHr } from '@/lib/auth-hr';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import type { HrInterviewCompleteResult } from '@/types/api';
import type { Stage } from '@/types/domain';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  score: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
  salary_discussed: z.number().nonnegative().optional(),
  availability_note: z.string().optional(),
  recommendation: z.string().optional(),
});

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ interviewId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  const { interviewId } = await context.params;

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

  try {
    const result = await tx(async (client) => {
      const interview = await oneTx<{
        id: string;
        application_id: string;
        status: string;
      }>(
        client,
        `SELECT id, application_id, status FROM HRSYSTEM_interviews WHERE id = $1 FOR UPDATE`,
        [interviewId],
      );
      if (!interview) return { kind: 'not_found' as const };
      if (interview.status !== 'SCHEDULED') return { kind: 'wrong_stage' as const };

      await client.query(
        `UPDATE HRSYSTEM_interviews SET
           status = 'COMPLETED',
           score = COALESCE($2, score),
           notes = COALESCE($3, notes),
           salary_discussed = COALESCE($4, salary_discussed),
           availability_note = COALESCE($5, availability_note),
           recommendation = COALESCE($6, recommendation),
           updated_at = now()
         WHERE id = $1`,
        [
          interviewId,
          parsed.data.score ?? null,
          parsed.data.notes ?? null,
          parsed.data.salary_discussed ?? null,
          parsed.data.availability_note ?? null,
          parsed.data.recommendation ?? null,
        ],
      );

      const app = await oneTx<{
        id: string;
        stage: Stage;
        candidate_id: string;
        job_id: string;
      }>(
        client,
        `UPDATE HRSYSTEM_applications
         SET stage = 'FINAL_INTERVIEW_COMPLETED'::HRSYSTEM_app_stage, updated_at = now()
         WHERE id = $1
         RETURNING id, stage, candidate_id, job_id`,
        [interview.application_id],
      );

      if (!app) return { kind: 'error' as const };

      await client.query(
        `INSERT INTO HRSYSTEM_recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_id, actor_label, payload
         ) VALUES (
           $1, $2, $3, 'INTERVIEW_COMPLETED',
           'FINAL_INTERVIEW_SCHEDULED'::HRSYSTEM_app_stage, 'FINAL_INTERVIEW_COMPLETED'::HRSYSTEM_app_stage,
           'HR', $4, $5, $6::jsonb
         )`,
        [
          app.id,
          app.candidate_id,
          app.job_id,
          user.id,
          user.name,
          JSON.stringify({ interview_id: interviewId, ...parsed.data }),
        ],
      );

      return {
        kind: 'ok' as const,
        data: { stage: 'FINAL_INTERVIEW_COMPLETED' as Stage } satisfies HrInterviewCompleteResult,
      };
    });

    if (result.kind === 'not_found') {
      return jsonError(404, 'NOT_FOUND', 'Interview not found');
    }
    if (result.kind === 'wrong_stage') {
      return jsonError(409, 'WRONG_STAGE', 'Interview is not open to complete');
    }
    if (result.kind !== 'ok') {
      return jsonError(500, 'INTERNAL_ERROR', 'Failed to complete interview');
    }
    return jsonOk(result.data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to complete interview');
  }
}
