import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { resolveToken } from '@/lib/assessment-token';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import { hashToken } from '@/lib/tokens';
import type { TechTestRecordingResult } from '@/types/api';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  recording: z.object({
    public_id: z.string().min(1),
    format: z.string().min(1),
    duration_seconds: z.number().nonnegative(),
    bytes: z.number().nonnegative(),
    started_at: z.string().min(1),
    ended_at: z.string().min(1),
    part_no: z.number().int().positive(),
  }),
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
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid recording payload.', {
      fields: ['recording'],
    });
  }

  const { recording } = parsed.data;

  try {
    const resolved = await resolveToken(token, 'TECH_TEST');
    if (!resolved.ok) {
      // After submit the token is used — allow retry by hash + sitting still UPLOAD_PENDING
      // Fall through to used-token path below only if SUBMITTED + UPLOAD_PENDING.
      if (resolved.error.code !== 'ALREADY_SUBMITTED') {
        const status = resolved.error.code === 'TOKEN_EXPIRED' ? 410 : 401;
        return jsonError(status, resolved.error.code, resolved.error.message);
      }
    }

    const result = await tx(async (client) => {
      let sittingId: string | null = resolved.ok ? resolved.data.sitting_id : null;
      let recordingStatus: string | null = resolved.ok
        ? resolved.data.recording_status
        : null;

      if (!sittingId) {
        const row = await oneTx<{ id: string; recording_status: string | null }>(
          client,
          `SELECT ca.id, ca.recording_status
           FROM access_tokens t
           JOIN candidate_assessments ca ON ca.id = t.candidate_assessment_id
           WHERE t.token_hash = $1 AND ca.kind = 'TECH_TEST'
           LIMIT 1`,
          [hashToken(token)],
        );
        if (!row) return { missing: true as const };
        sittingId = row.id;
        recordingStatus = row.recording_status;
      }

      if (recordingStatus === 'READY') {
        return {
          missing: false as const,
          data: { recording_status: 'READY' } satisfies TechTestRecordingResult,
        };
      }

      await client.query(
        `INSERT INTO recordings (
           candidate_assessment_id, part_no, public_id, resource_type, delivery_type,
           format, duration_seconds, bytes, started_at, ended_at
         ) VALUES ($1, $2, $3, 'video', 'authenticated', $4, $5, $6, $7::timestamptz, $8::timestamptz)
         ON CONFLICT (candidate_assessment_id, part_no) DO UPDATE SET
           public_id = EXCLUDED.public_id,
           format = EXCLUDED.format,
           duration_seconds = EXCLUDED.duration_seconds,
           bytes = EXCLUDED.bytes,
           started_at = EXCLUDED.started_at,
           ended_at = EXCLUDED.ended_at`,
        [
          sittingId,
          recording.part_no,
          recording.public_id,
          recording.format,
          Math.round(recording.duration_seconds),
          recording.bytes,
          recording.started_at,
          recording.ended_at,
        ],
      );

      await client.query(
        `UPDATE candidate_assessments
         SET recording_status = 'READY', updated_at = now()
         WHERE id = $1`,
        [sittingId],
      );

      return {
        missing: false as const,
        data: { recording_status: 'READY' } satisfies TechTestRecordingResult,
      };
    });

    if (result.missing) {
      return jsonError(401, 'TOKEN_INVALID', 'This link is not valid.');
    }

    return jsonOk(result.data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to save recording');
  }
}
