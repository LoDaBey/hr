import { after } from 'next/server';
import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { resolveToken } from '@/lib/assessment-token';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import { gradeAssessment } from '@/lib/pipeline/grading';
import type { CandidateAssessmentSubmitResult } from '@/types/api';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        answer: z.unknown(),
        time_spent_seconds: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
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
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return jsonError(401, 'TOKEN_INVALID', 'This link is not valid.');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw);
  const answers = parsed.success ? parsed.data.answers : [];

  try {
    const resolved = await resolveToken(token, 'ASSESSMENT');
    if (!resolved.ok) {
      const status =
        resolved.error.code === 'ALREADY_SUBMITTED'
          ? 409
          : resolved.error.code === 'TOKEN_EXPIRED'
            ? 410
            : 401;
      return jsonError(status, resolved.error.code, resolved.error.message);
    }

    const sitting = resolved.data;
    if (sitting.status === 'SUBMITTED') {
      return jsonError(409, 'ALREADY_SUBMITTED', 'You have already submitted this assessment.');
    }

    const result = await tx(async (client) => {
      for (const row of answers) {
        await client.query(
          `INSERT INTO assessment_answers (
             candidate_assessment_id, question_id, answer, time_spent_seconds, answered_at
           )
           VALUES ($1, $2, $3::jsonb, $4, now())
           ON CONFLICT (candidate_assessment_id, question_id) DO UPDATE SET
             answer = EXCLUDED.answer,
             time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, assessment_answers.time_spent_seconds),
             answered_at = now()`,
          [
            sitting.sitting_id,
            row.question_id,
            JSON.stringify(row.answer ?? null),
            row.time_spent_seconds ?? null,
          ],
        );
      }

      const updated = await oneTx<{
        submitted_at: string;
        late: boolean;
      }>(
        client,
        `UPDATE candidate_assessments
         SET status = 'SUBMITTED',
             submitted_at = now(),
             late = CASE
               WHEN expires_at IS NOT NULL AND now() > expires_at THEN true
               ELSE false
             END,
             updated_at = now()
         WHERE id = $1 AND status IN ('INVITED', 'STARTED')
         RETURNING submitted_at, late`,
        [sitting.sitting_id],
      );

      if (!updated) {
        return { conflict: true as const };
      }

      await client.query(
        `UPDATE access_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL`,
        [sitting.token_id],
      );

      await client.query(
        `UPDATE applications
         SET stage = 'TECH_ASSESSMENT_SUBMITTED'::app_stage, updated_at = now()
         WHERE id = $1`,
        [sitting.application_id],
      );

      await client.query(
        `INSERT INTO recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_label, payload
         )
         SELECT a.id, a.candidate_id, a.job_id, 'ASSESSMENT_SUBMITTED',
                $2::app_stage, 'TECH_ASSESSMENT_SUBMITTED'::app_stage,
                'CANDIDATE', $3, $4::jsonb
         FROM applications a
         WHERE a.id = $1`,
        [
          sitting.application_id,
          sitting.stage,
          sitting.candidate_name,
          JSON.stringify({
            candidate_assessment_id: sitting.sitting_id,
            late: updated.late,
          }),
        ],
      );

      return {
        conflict: false as const,
        data: {
          submitted_at: updated.submitted_at,
          late: updated.late,
        } satisfies CandidateAssessmentSubmitResult,
        sittingId: sitting.sitting_id,
      };
    });

    if (result.conflict) {
      return jsonError(409, 'ALREADY_SUBMITTED', 'You have already submitted this assessment.');
    }

    after(() => {
      void gradeAssessment(result.sittingId).catch((error) => {
        console.error('gradeAssessment failed', error);
      });
    });

    return jsonOk(result.data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to submit assessment');
  }
}
