import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { resolveToken } from '@/lib/assessment-token';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import type { TechTestEventResult } from '@/types/api';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  event_id: z.string().min(1),
  event: z.string().min(1),
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
  occurred_at: z.string().min(1),
  metadata: z.unknown().optional(),
});

const bodySchema = z.object({
  token: z.string().optional(),
  events: z.array(eventSchema).min(1).max(100),
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
    return jsonError(400, 'VALIDATION_FAILED', 'Request body must be JSON.');
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid event batch.', {
      fields: ['events'],
    });
  }

  try {
    const resolved = await resolveToken(token, 'TECH_TEST');
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
    if (sitting.status === 'SUBMITTED' || sitting.status === 'EXPIRED') {
      return jsonError(409, 'WRONG_STAGE', 'This session is no longer accepting events.');
    }

    const result = await tx(async (client) => {
      let accepted = 0;
      let duplicates = 0;

      for (const ev of parsed.data.events) {
        const inserted = await oneTx<{ id: string }>(
          client,
          `INSERT INTO HRSYSTEM_proctoring_events (
             candidate_assessment_id, event, severity, occurred_at, metadata, event_id
           ) VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb, $6)
           ON CONFLICT (candidate_assessment_id, event_id) DO NOTHING
           RETURNING id`,
          [
            sitting.sitting_id,
            ev.event,
            ev.severity,
            ev.occurred_at,
            JSON.stringify(ev.metadata ?? {}),
            ev.event_id,
          ],
        );
        if (inserted) accepted += 1;
        else duplicates += 1;
      }

      await client.query(
        `UPDATE HRSYSTEM_candidate_assessments
         SET violations_count = (
               SELECT count(*)::int
               FROM HRSYSTEM_proctoring_events
               WHERE candidate_assessment_id = $1
                 AND severity IN ('WARN', 'CRITICAL')
             ),
             updated_at = now()
         WHERE id = $1`,
        [sitting.sitting_id],
      );

      return { accepted, duplicates } satisfies TechTestEventResult;
    });

    return jsonOk(result);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to record proctoring events');
  }
}
