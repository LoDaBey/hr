import { after } from 'next/server';
import type { PoolClient, QueryResultRow } from 'pg';
import type { ApplicationSubmitResult, ErrorCode } from '@/types/api';
import type { Application, Candidate, Job, JobQuestion, Stage } from '@/types/domain';
import { clientIp, jsonError, jsonOk } from '@/lib/http';
import { tx } from '@/lib/db';
import { isRateLimited } from '@/lib/rate-limit';
import { runCvParseAndScreening } from '@/lib/pipeline/screening';
import { applicationSubmitSchema } from '@/lib/schemas/application';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

class SubmitError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields?: string[],
  ) {
    super(message);
  }
}

function isPgUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

function isMissingAnswer(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const limited = await isRateLimited(`apply:${clientIp(req)}`, 5, 3600);
    if (limited) {
      return jsonError(429, 'RATE_LIMITED', 'Too many applications from this network');
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
    }

    const parsed = applicationSubmitSchema.safeParse(raw);
    if (!parsed.success) {
      const fields = [
        ...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
      ];
      return jsonError(400, 'VALIDATION_FAILED', 'Validation failed', { fields });
    }

    const input = parsed.data;
    const result = await tx(async (client) => {
      const existing = await oneTx<Pick<Application, 'id' | 'candidate_id' | 'stage'>>(
        client,
        `SELECT id, candidate_id, stage FROM HRSYSTEM_applications WHERE submission_id = $1`,
        [input.idempotency_key],
      );
      if (existing) {
        return {
          replay: true,
          data: {
            application_id: existing.id,
            candidate_id: existing.candidate_id,
            stage: existing.stage,
          } satisfies ApplicationSubmitResult,
        };
      }

      const job = await oneTx<Job>(client, `SELECT * FROM HRSYSTEM_jobs WHERE id = $1`, [input.job_id]);
      if (!job) {
        throw new SubmitError(404, 'NOT_FOUND', 'Job not found');
      }
      if (job.status !== 'OPEN') {
        throw new SubmitError(409, 'JOB_CLOSED', 'This role is no longer open');
      }
      if (job.application_deadline && new Date(job.application_deadline).getTime() <= Date.now()) {
        throw new SubmitError(400, 'DEADLINE_PASSED', 'The application deadline has passed');
      }

      const questions = (
        await client.query<JobQuestion>(
          `SELECT * FROM HRSYSTEM_job_questions WHERE job_id = $1 ORDER BY order_index`,
          [job.id],
        )
      ).rows;

      const missingRequired = questions.filter(
        (question) => question.is_required && isMissingAnswer(input.answers[question.key]),
      );
      if (missingRequired.length || (job.cv_required && !input.cv)) {
        throw new SubmitError(400, 'UPLOAD_INCOMPLETE', 'Application is incomplete');
      }

      const candidate = await oneTx<Candidate>(
        client,
        `INSERT INTO HRSYSTEM_candidates (email, phone, full_name, country, city, age, military_status, marital_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           phone_history = CASE
             WHEN HRSYSTEM_candidates.phone IS DISTINCT FROM EXCLUDED.phone AND HRSYSTEM_candidates.phone IS NOT NULL
             THEN HRSYSTEM_candidates.phone_history || to_jsonb(HRSYSTEM_candidates.phone)
             ELSE HRSYSTEM_candidates.phone_history
           END,
           country = COALESCE(EXCLUDED.country, HRSYSTEM_candidates.country),
           city = COALESCE(EXCLUDED.city, HRSYSTEM_candidates.city),
           age = COALESCE(EXCLUDED.age, HRSYSTEM_candidates.age),
           military_status = COALESCE(EXCLUDED.military_status, HRSYSTEM_candidates.military_status),
           marital_status = COALESCE(EXCLUDED.marital_status, HRSYSTEM_candidates.marital_status)
         RETURNING *`,
        [
          input.candidate.email,
          input.candidate.phone,
          input.candidate.full_name,
          input.candidate.country ?? null,
          input.candidate.city ?? null,
          input.candidate.age ?? null,
          input.candidate.military_status ?? null,
          input.candidate.marital_status ?? null,
        ],
      );
      if (!candidate) {
        throw new SubmitError(500, 'INTERNAL_ERROR', 'Could not save candidate');
      }

      const duplicate = await oneTx<{ id: string }>(
        client,
        `SELECT id FROM HRSYSTEM_applications
         WHERE candidate_id = $1 AND job_id = $2
           AND (
             status NOT IN ('REJECTED', 'WITHDRAWN')
             OR (
               status = 'REJECTED'
               AND created_at > now() - ($3 || ' days')::interval
             )
           )
         LIMIT 1`,
        [candidate.id, job.id, String(job.allow_reapply_days)],
      );
      if (duplicate) {
        throw new SubmitError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this role');
      }

      let application: Pick<Application, 'id' | 'candidate_id' | 'stage'>;
      try {
        const inserted = await oneTx<Pick<Application, 'id' | 'candidate_id' | 'stage'>>(
          client,
          `INSERT INTO HRSYSTEM_applications (
             candidate_id, job_id, employment_status, current_company, current_position,
             years_experience, expected_salary, notice_period_days, available_from,
             source, submission_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PORTAL', $10)
           RETURNING id, candidate_id, stage`,
          [
            candidate.id,
            job.id,
            input.professional?.employment_status ?? null,
            input.professional?.current_company ?? null,
            input.professional?.current_position ?? null,
            input.professional?.years_experience ?? null,
            input.professional?.expected_salary ?? null,
            input.professional?.notice_period_days ?? null,
            input.professional?.available_from ?? null,
            input.idempotency_key,
          ],
        );
        if (!inserted) {
          throw new SubmitError(500, 'INTERNAL_ERROR', 'Could not save application');
        }
        application = inserted;
      } catch (error) {
        if (isPgUniqueViolation(error) && String(error.constraint ?? '').includes('submission_id')) {
          const replayed = await oneTx<Pick<Application, 'id' | 'candidate_id' | 'stage'>>(
            client,
            `SELECT id, candidate_id, stage FROM HRSYSTEM_applications WHERE submission_id = $1`,
            [input.idempotency_key],
          );
          if (replayed) {
            return {
              replay: true,
              data: {
                application_id: replayed.id,
                candidate_id: replayed.candidate_id,
                stage: replayed.stage,
              } satisfies ApplicationSubmitResult,
            };
          }
        }
        if (isPgUniqueViolation(error)) {
          throw new SubmitError(409, 'DUPLICATE_APPLICATION', 'You have already applied to this role');
        }
        throw error;
      }

      await client.query(
        `INSERT INTO HRSYSTEM_application_answers (application_id, question_id, question_key, answer)
         SELECT $1, q.id, kv.key, kv.value
         FROM jsonb_each($2::jsonb) kv
         LEFT JOIN HRSYSTEM_job_questions q ON q.job_id = $3 AND q.key = kv.key`,
        [application.id, JSON.stringify(input.answers ?? {}), job.id],
      );

      if (input.cv) {
        await client.query(
          `INSERT INTO HRSYSTEM_documents (
             candidate_id, application_id, doc_type, public_id, resource_type,
             delivery_type, format, bytes, original_name
           )
           VALUES ($1, $2, 'CV', $3, $4, $5, $6, $7, $8)`,
          [
            candidate.id,
            application.id,
            input.cv.public_id,
            input.cv.resource_type,
            input.cv.delivery_type,
            input.cv.format,
            input.cv.bytes,
            input.cv.original_name,
          ],
        );
      }

      await client.query(
        `INSERT INTO HRSYSTEM_recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, payload
         )
         VALUES ($1, $2, $3, 'APPLICATION_SUBMITTED', NULL, $4, 'CANDIDATE', $5::jsonb)`,
        [
          application.id,
          candidate.id,
          job.id,
          application.stage,
          JSON.stringify({ submission_id: input.idempotency_key }),
        ],
      );

      await client.query(
        `INSERT INTO HRSYSTEM_communications (
           candidate_id, application_id, template_key, to_email, subject, variables, dedupe_key
         )
         VALUES ($1, $2, 'APPLICATION_RECEIVED', $3, $4, $5::jsonb, $6)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          candidate.id,
          application.id,
          candidate.email,
          `We received your application for ${job.title}`,
          JSON.stringify({
            candidate_name: candidate.full_name,
            job_title: job.title,
            hr_name: 'HR Team',
          }),
          `${application.id}:APPLICATION_RECEIVED:v1`,
        ],
      );

      return {
        replay: false,
        data: {
          application_id: application.id,
          candidate_id: application.candidate_id,
          stage: application.stage as Stage,
        } satisfies ApplicationSubmitResult,
      };
    });

    if (!result.replay) {
      after(async () => {
        await runCvParseAndScreening(result.data.application_id);
      });
    }

    return jsonOk(result.data);
  } catch (error) {
    if (error instanceof SubmitError) {
      return jsonError(error.status, error.code, error.message, { fields: error.fields });
    }
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Could not submit application');
  }
}
