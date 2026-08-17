import type { PoolClient, QueryResultRow } from 'pg';
import { resolveToken } from '@/lib/assessment-token';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import type { CandidateAssessmentStartResult } from '@/types/api';

export const dynamic = 'force-dynamic';

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return jsonError(401, 'TOKEN_INVALID', 'This link is not valid.');
  }

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

    const result = await tx(async (client) => {
      const times = await oneTx<{ started_at: string; expires_at: string }>(
        client,
        `UPDATE candidate_assessments
         SET status = 'STARTED',
             started_at = COALESCE(started_at, now()),
             expires_at = COALESCE(
               expires_at,
               now() + (duration_minutes || ' minutes')::interval
             ),
             updated_at = now()
         WHERE id = $1 AND status IN ('INVITED', 'STARTED')
         RETURNING started_at, expires_at`,
        [sitting.sitting_id],
      );

      if (!times) {
        return { conflict: true as const };
      }

      if (sitting.stage !== 'TECH_ASSESSMENT_STARTED') {
        await client.query(
          `UPDATE applications
           SET stage = 'TECH_ASSESSMENT_STARTED'::app_stage, updated_at = now()
           WHERE id = $1`,
          [sitting.application_id],
        );

        await client.query(
          `INSERT INTO recruitment_events (
             application_id, candidate_id, job_id, event_type,
             from_stage, to_stage, actor_type, actor_label, payload
           )
           SELECT a.id, a.candidate_id, a.job_id, 'ASSESSMENT_STARTED',
                  $2::app_stage, 'TECH_ASSESSMENT_STARTED'::app_stage,
                  'CANDIDATE', $3, $4::jsonb
           FROM applications a
           WHERE a.id = $1`,
          [
            sitting.application_id,
            sitting.stage,
            sitting.candidate_name,
            JSON.stringify({ candidate_assessment_id: sitting.sitting_id }),
          ],
        );
      }

      const serverTime = await oneTx<{ now: string }>(client, `SELECT now() AS now`);

      const data: CandidateAssessmentStartResult = {
        started_at: times.started_at,
        expires_at: times.expires_at,
        server_time: serverTime?.now ?? new Date().toISOString(),
      };

      return { conflict: false as const, data };
    });

    if (result.conflict) {
      return jsonError(409, 'WRONG_STAGE', 'This assessment cannot be started.');
    }

    return jsonOk(result.data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to start assessment');
  }
}
