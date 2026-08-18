import { after } from 'next/server';
import { z } from 'zod';
import type { PoolClient, QueryResultRow } from 'pg';
import { resolveToken } from '@/lib/assessment-token';
import { tx } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import { evaluateTechTest } from '@/lib/pipeline/grading';
import type { TechTestSubmitResult } from '@/types/api';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  event_id: z.string().min(1),
  event: z.string().min(1),
  severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
  occurred_at: z.string().min(1),
  metadata: z.unknown().optional(),
});

const recordingSchema = z.object({
  public_id: z.string().min(1),
  format: z.string().min(1),
  duration_seconds: z.number().nonnegative(),
  bytes: z.number().nonnegative(),
  started_at: z.string().min(1),
  ended_at: z.string().min(1),
  part_no: z.number().int().positive(),
});

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
  recording: recordingSchema.optional(),
  events: z.array(eventSchema).optional(),
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
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid submit payload.');
  }

  const { answers, recording, events } = parsed.data;

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
    if (sitting.status === 'SUBMITTED') {
      return jsonError(409, 'ALREADY_SUBMITTED', 'You have already submitted this session.');
    }

    const result = await tx(async (client) => {
      for (const row of answers) {
        await client.query(
          `INSERT INTO HRSYSTEM_assessment_answers (
             candidate_assessment_id, question_id, answer, time_spent_seconds, answered_at
           )
           VALUES ($1, $2, $3::jsonb, $4, now())
           ON CONFLICT (candidate_assessment_id, question_id) DO UPDATE SET
             answer = EXCLUDED.answer,
             time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, HRSYSTEM_assessment_answers.time_spent_seconds),
             answered_at = now()`,
          [
            sitting.sitting_id,
            row.question_id,
            JSON.stringify(row.answer ?? null),
            row.time_spent_seconds ?? null,
          ],
        );
      }

      if (events?.length) {
        for (const ev of events) {
          await client.query(
            `INSERT INTO HRSYSTEM_proctoring_events (
               candidate_assessment_id, event, severity, occurred_at, metadata, event_id
             ) VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb, $6)
             ON CONFLICT (candidate_assessment_id, event_id) DO NOTHING`,
            [
              sitting.sitting_id,
              ev.event,
              ev.severity,
              ev.occurred_at,
              JSON.stringify(ev.metadata ?? {}),
              ev.event_id,
            ],
          );
        }
        await client.query(
          `UPDATE HRSYSTEM_candidate_assessments
           SET violations_count = (
                 SELECT count(*)::int FROM HRSYSTEM_proctoring_events
                 WHERE candidate_assessment_id = $1 AND severity IN ('WARN', 'CRITICAL')
               ),
               updated_at = now()
           WHERE id = $1`,
          [sitting.sitting_id],
        );
      }

      let recordingStatus = sitting.recording_status ?? 'UPLOAD_PENDING';
      if (recording) {
        await client.query(
          `INSERT INTO HRSYSTEM_recordings (
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
            sitting.sitting_id,
            recording.part_no,
            recording.public_id,
            recording.format,
            Math.round(recording.duration_seconds),
            recording.bytes,
            recording.started_at,
            recording.ended_at,
          ],
        );
        recordingStatus = 'READY';
      } else {
        recordingStatus = 'UPLOAD_PENDING';
      }

      const updated = await oneTx<{ submitted_at: string }>(
        client,
        `UPDATE HRSYSTEM_candidate_assessments
         SET status = 'SUBMITTED',
             submitted_at = now(),
             late = CASE
               WHEN expires_at IS NOT NULL AND now() > expires_at THEN true
               ELSE false
             END,
             recording_status = $2,
             updated_at = now()
         WHERE id = $1 AND status IN ('INVITED', 'STARTED')
         RETURNING submitted_at`,
        [sitting.sitting_id, recordingStatus],
      );

      if (!updated) {
        return { conflict: true as const };
      }

      await client.query(
        `UPDATE HRSYSTEM_access_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL`,
        [sitting.token_id],
      );

      await client.query(
        `UPDATE HRSYSTEM_applications
         SET stage = 'RECORDED_TECH_SUBMITTED'::HRSYSTEM_app_stage, updated_at = now()
         WHERE id = $1`,
        [sitting.application_id],
      );

      await client.query(
        `INSERT INTO HRSYSTEM_recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_label, payload
         )
         SELECT a.id, a.candidate_id, a.job_id, 'TECHTEST_SUBMITTED',
                $2::HRSYSTEM_app_stage, 'RECORDED_TECH_SUBMITTED'::HRSYSTEM_app_stage,
                'CANDIDATE', $3, $4::jsonb
         FROM HRSYSTEM_applications a
         WHERE a.id = $1`,
        [
          sitting.application_id,
          sitting.stage,
          sitting.candidate_name,
          JSON.stringify({
            candidate_assessment_id: sitting.sitting_id,
            recording_status: recordingStatus,
          }),
        ],
      );

      return {
        conflict: false as const,
        data: {
          submitted_at: updated.submitted_at,
          recording_status: recordingStatus,
        } satisfies TechTestSubmitResult,
        sittingId: sitting.sitting_id,
      };
    });

    if (result.conflict) {
      return jsonError(409, 'ALREADY_SUBMITTED', 'You have already submitted this session.');
    }

    after(() => {
      void evaluateTechTest(result.sittingId).catch((error) => {
        console.error('evaluateTechTest failed', error);
      });
    });

    return jsonOk(result.data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to submit tech interview');
  }
}
