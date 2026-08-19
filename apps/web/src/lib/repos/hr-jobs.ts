import 'server-only';
import type { PoolClient, QueryResultRow } from 'pg';
import { one, query, tx } from '@/lib/db';
import { listJobQuestions } from '@/lib/repos/jobs';
import { slugifyTitle } from '@/lib/slug';
import type {
  HrJobsAssessmentSetPayload,
  HrJobsAssessmentSetResult,
  HrJobsCreateResult,
  HrJobsDeleteResult,
  HrJobsGetResult,
  HrJobsQuestionsSetPayload,
  HrJobsQuestionsSetResult,
  HrJobsUpdateResult,
} from '@/types/api';
import type {
  AssessmentKind,
  HardFailAction,
  HardRequirement,
  HardRequirementOp,
  Job,
  JobQuestion,
  JobQuestionType,
  JobStatus,
} from '@/types/domain';

const HARD_OPS: HardRequirementOp[] = ['>=', '<=', '==', 'in', 'truthy'];
const HARD_FAILS: HardFailAction[] = ['RECOMMEND_REJECT', 'MANUAL_REVIEW'];
const JOB_QUESTION_TYPES: JobQuestionType[] = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'SELECT',
  'MULTISELECT',
  'BOOLEAN',
  'YEARS',
];

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export function validateHardRequirements(value: unknown): HardRequirement[] | null {
  if (!Array.isArray(value)) return null;
  const out: HardRequirement[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === 'string' ? row.key : '';
    const label = typeof row.label === 'string' ? row.label : '';
    const op = row.op as HardRequirementOp;
    const onFail = row.on_fail as HardFailAction;
    if (!key || !label || !HARD_OPS.includes(op) || !HARD_FAILS.includes(onFail)) {
      return null;
    }
    out.push({
      key,
      label,
      op,
      value: row.value,
      on_fail: onFail,
    });
  }
  return out;
}

export async function allocateJobSlug(title: string, client?: PoolClient): Promise<string> {
  const base = slugifyTitle(title);
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = client
      ? await oneTx<{ id: string }>(client, `SELECT id FROM HRSYSTEM_jobs WHERE slug = $1`, [candidate])
      : await one<{ id: string }>(`SELECT id FROM HRSYSTEM_jobs WHERE slug = $1`, [candidate]);
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
}

export async function getHrJobDetail(jobId: string): Promise<HrJobsGetResult | null> {
  const job = await one<Job>(`SELECT * FROM HRSYSTEM_jobs WHERE id = $1`, [jobId]);
  if (!job) return null;
  const [questions, assessmentRows] = await Promise.all([
    listJobQuestions(jobId),
    query<{
      id: string;
      kind: AssessmentKind;
      title: string;
      instructions: string | null;
      duration_minutes: number;
      pass_score: number;
      require_camera: boolean;
      require_mic: boolean;
      require_fullscreen: boolean;
      require_screen_share: boolean;
      rules: string | null;
      is_active: boolean;
    }>(
      `SELECT a.id, a.kind, a.title, a.instructions, a.duration_minutes, a.pass_score,
              a.require_camera, a.require_mic, a.require_fullscreen, a.require_screen_share, a.rules, a.is_active
       FROM HRSYSTEM_assessments a
       WHERE a.job_id = $1
       ORDER BY a.kind, a.is_active DESC, a.created_at DESC`,
      [jobId],
    ),
  ]);

  const assessments = await Promise.all(
    assessmentRows.map(async (row) => {
      const aq = await query<import('@/types/domain').AssessmentQuestion>(
        `SELECT * FROM HRSYSTEM_assessment_questions
         WHERE assessment_id = $1
         ORDER BY order_index`,
        [row.id],
      );
      return { ...row, questions: aq };
    }),
  );

  return { job, questions: questions as JobQuestion[], assessments };
}

export async function listHrJobs(status: JobStatus | null = null): Promise<
  Array<
    Job & {
      assessment_question_count: number | null;
      assessment_duration_minutes: number | null;
    }
  >
> {
  return query(
    `SELECT j.*,
            a.duration_minutes AS assessment_duration_minutes,
            (
              SELECT count(*)::int FROM HRSYSTEM_assessment_questions aq WHERE aq.assessment_id = a.id
            ) AS assessment_question_count
     FROM HRSYSTEM_jobs j
     LEFT JOIN HRSYSTEM_assessments a
       ON a.job_id = j.id AND a.kind = 'ASSESSMENT' AND a.is_active = true
     WHERE ($1::text IS NULL OR j.status = $1)
     ORDER BY j.created_at DESC`,
    [status],
  );
}

export type CreateJobInput = {
  title: string;
  department?: string | null;
  description?: string | null;
  employment_type?: string | null;
  location?: string | null;
  work_mode?: string | null;
  min_experience_years?: number | null;
  required_skills?: string[];
  preferred_skills?: string[];
  education_requirement?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  languages?: unknown;
  notice_period_max_days?: number | null;
  ask_age?: boolean;
  ask_military_status?: boolean;
  ask_marital_status?: boolean;
  hard_requirements?: unknown;
  soft_requirements?: unknown;
  screening_weights?: unknown;
  shortlist_threshold?: number;
  cv_required?: boolean;
  allow_reapply_days?: number;
  assessment_invite_hours?: number;
  techtest_invite_hours?: number;
  application_deadline?: string | null;
  vacancies?: number;
  hiring_manager?: string | null;
};

export async function createHrJob(
  input: CreateJobInput,
  actor: { id: string; name: string },
): Promise<HrJobsCreateResult> {
  const hard = validateHardRequirements(input.hard_requirements ?? []);
  if (hard === null) {
    throw Object.assign(new Error('Invalid hard_requirements'), { code: 'VALIDATION_FAILED' });
  }

  return tx(async (client) => {
    const slug = await allocateJobSlug(input.title, client);
    const job = await oneTx<{ id: string; slug: string }>(
      client,
      `INSERT INTO HRSYSTEM_jobs (
         slug, title, department, description, employment_type, location, work_mode,
         min_experience_years, required_skills, preferred_skills, education_requirement,
         salary_min, salary_max, currency, languages, notice_period_max_days,
         ask_age, ask_military_status, ask_marital_status,
         hard_requirements, soft_requirements, screening_weights, shortlist_threshold,
         cv_required, allow_reapply_days, assessment_invite_hours, techtest_invite_hours,
         application_deadline, vacancies, hiring_manager, status, created_by
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,
         $12,$13,$14,$15::jsonb,$16,
         $17,$18,$19,
         $20::jsonb,$21::jsonb,COALESCE($22::jsonb, '{"skills":40,"experience":30,"answers":20,"education":10}'::jsonb),$23,
         $24,$25,$26,$27,
         $28::timestamptz,$29,$30,'DRAFT',$31
       )
       RETURNING id, slug`,
      [
        slug,
        input.title,
        input.department ?? null,
        input.description ?? null,
        input.employment_type ?? null,
        input.location ?? null,
        input.work_mode ?? null,
        input.min_experience_years ?? 0,
        input.required_skills ?? [],
        input.preferred_skills ?? [],
        input.education_requirement ?? null,
        input.salary_min ?? null,
        input.salary_max ?? null,
        input.currency ?? 'USD',
        JSON.stringify(input.languages ?? {}),
        input.notice_period_max_days ?? null,
        input.ask_age ?? false,
        input.ask_military_status ?? false,
        input.ask_marital_status ?? false,
        JSON.stringify(hard),
        JSON.stringify(input.soft_requirements ?? []),
        input.screening_weights == null ? null : JSON.stringify(input.screening_weights),
        input.shortlist_threshold ?? 70,
        input.cv_required ?? true,
        input.allow_reapply_days ?? 180,
        input.assessment_invite_hours ?? 48,
        input.techtest_invite_hours ?? 48,
        input.application_deadline ?? null,
        input.vacancies ?? 1,
        input.hiring_manager ?? null,
        actor.id,
      ],
    );
    if (!job) throw new Error('Failed to create job');

    await client.query(
      `INSERT INTO HRSYSTEM_recruitment_events (
         job_id, event_type, actor_type, actor_id, actor_label, payload
       ) VALUES ($1, 'JOB_CREATED', 'HR', $2, $3, $4::jsonb)`,
      [job.id, actor.id, actor.name, JSON.stringify({ slug: job.slug, title: input.title })],
    );

    return { job_id: job.id, slug: job.slug };
  });
}

const PATCHABLE: Array<keyof CreateJobInput | 'status' | 'assigned_hr_id'> = [
  'title',
  'department',
  'description',
  'employment_type',
  'location',
  'work_mode',
  'min_experience_years',
  'required_skills',
  'preferred_skills',
  'education_requirement',
  'salary_min',
  'salary_max',
  'currency',
  'languages',
  'notice_period_max_days',
  'ask_age',
  'ask_military_status',
  'ask_marital_status',
  'hard_requirements',
  'soft_requirements',
  'screening_weights',
  'shortlist_threshold',
  'cv_required',
  'allow_reapply_days',
  'assessment_invite_hours',
  'techtest_invite_hours',
  'application_deadline',
  'vacancies',
  'hiring_manager',
  'status',
  'assigned_hr_id',
];

export async function updateHrJob(
  jobId: string,
  patch: Record<string, unknown>,
  actor: { id: string; name: string },
): Promise<HrJobsUpdateResult> {
  const existing = await one<Job>(`SELECT * FROM HRSYSTEM_jobs WHERE id = $1`, [jobId]);
  if (!existing) {
    throw Object.assign(new Error('Job not found'), { code: 'NOT_FOUND' });
  }

  if (patch.hard_requirements !== undefined) {
    const hard = validateHardRequirements(patch.hard_requirements);
    if (hard === null) {
      throw Object.assign(new Error('Invalid hard_requirements'), { code: 'VALIDATION_FAILED' });
    }
    patch.hard_requirements = hard;
  }

  const nextStatus = patch.status as JobStatus | undefined;
  if (nextStatus === 'OPEN' && existing.status !== 'OPEN') {
    const qCount = await one<{ count: number }>(
      `SELECT count(*)::int AS count FROM HRSYSTEM_job_questions WHERE job_id = $1`,
      [jobId],
    );
    if (!qCount || qCount.count < 1) {
      throw Object.assign(new Error('Cannot publish a job with no questions'), {
        code: 'VALIDATION_FAILED',
      });
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  for (const key of PATCHABLE) {
    if (!(key in patch)) continue;
    let value = patch[key];
    if (
      key === 'hard_requirements' ||
      key === 'soft_requirements' ||
      key === 'screening_weights' ||
      key === 'languages'
    ) {
      value = JSON.stringify(
        value ?? (key === 'languages' || key === 'screening_weights' ? {} : []),
      );
      sets.push(`${key} = $${i}::jsonb`);
    } else if (key === 'required_skills' || key === 'preferred_skills') {
      sets.push(`${key} = $${i}`);
    } else if (key === 'application_deadline') {
      sets.push(`${key} = $${i}::timestamptz`);
    } else {
      sets.push(`${key} = $${i}`);
    }
    params.push(value);
    i += 1;
  }

  if (sets.length === 0) {
    return { job_id: jobId };
  }

  sets.push('updated_at = now()');
  params.push(jobId);

  await tx(async (client) => {
    await client.query(
      `UPDATE HRSYSTEM_jobs SET ${sets.join(', ')} WHERE id = $${i}`,
      params,
    );

    const published = nextStatus === 'OPEN' && existing.status !== 'OPEN';
    await client.query(
      `INSERT INTO HRSYSTEM_recruitment_events (
         job_id, event_type, actor_type, actor_id, actor_label, payload
       ) VALUES ($1, $2, 'HR', $3, $4, $5::jsonb)`,
      [
        jobId,
        published ? 'JOB_PUBLISHED' : 'JOB_UPDATED',
        actor.id,
        actor.name,
        JSON.stringify({ patch: Object.keys(patch), from_status: existing.status, to_status: nextStatus ?? existing.status }),
      ],
    );
  });

  return { job_id: jobId };
}

export async function deleteHrJob(jobId: string): Promise<HrJobsDeleteResult> {
  const existing = await one<{ id: string }>(`SELECT id FROM HRSYSTEM_jobs WHERE id = $1`, [jobId]);
  if (!existing) {
    throw Object.assign(new Error('Job not found'), { code: 'NOT_FOUND' });
  }

  await tx(async (client) => {
    await client.query(
      `DELETE FROM HRSYSTEM_candidate_assessments
       WHERE application_id IN (SELECT id FROM HRSYSTEM_applications WHERE job_id = $1)
          OR assessment_id IN (SELECT id FROM HRSYSTEM_assessments WHERE job_id = $1)`,
      [jobId],
    );
    await client.query(`DELETE FROM HRSYSTEM_jobs WHERE id = $1`, [jobId]);
  });

  return { job_id: jobId };
}

export async function replaceJobQuestions(
  jobId: string,
  questions: HrJobsQuestionsSetPayload['questions'],
): Promise<HrJobsQuestionsSetResult> {
  const job = await one<{ id: string }>(`SELECT id FROM HRSYSTEM_jobs WHERE id = $1`, [jobId]);
  if (!job) {
    throw Object.assign(new Error('Job not found'), { code: 'NOT_FOUND' });
  }

  for (const [index, q] of questions.entries()) {
    if (!q.label?.trim() || !q.key?.trim()) {
      throw Object.assign(new Error('Each question needs label and key'), {
        code: 'VALIDATION_FAILED',
      });
    }
    if (!JOB_QUESTION_TYPES.includes(q.type)) {
      throw Object.assign(new Error(`Invalid question type at index ${index}`), {
        code: 'VALIDATION_FAILED',
      });
    }
  }

  return tx(async (client) => {
    await client.query(`DELETE FROM HRSYSTEM_job_questions WHERE job_id = $1`, [jobId]);
    for (const [index, q] of questions.entries()) {
      await client.query(
        `INSERT INTO HRSYSTEM_job_questions (job_id, order_index, label, key, type, options, is_required)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          jobId,
          q.order_index ?? index,
          q.label,
          q.key,
          q.type,
          JSON.stringify(q.options ?? []),
          q.is_required ?? true,
        ],
      );
    }
    return { count: questions.length };
  });
}

export async function replaceJobAssessment(
  jobId: string,
  input: HrJobsAssessmentSetPayload,
): Promise<HrJobsAssessmentSetResult> {
  const job = await one<{ id: string }>(`SELECT id FROM HRSYSTEM_jobs WHERE id = $1`, [jobId]);
  if (!job) {
    throw Object.assign(new Error('Job not found'), { code: 'NOT_FOUND' });
  }
  if (input.kind !== 'ASSESSMENT' && input.kind !== 'TECH_TEST') {
    throw Object.assign(new Error('Invalid assessment kind'), { code: 'VALIDATION_FAILED' });
  }
  if (!input.title?.trim() || !Array.isArray(input.questions) || input.questions.length === 0) {
    throw Object.assign(new Error('Assessment needs a title and at least one question'), {
      code: 'VALIDATION_FAILED',
    });
  }

  return tx(async (client) => {
    // Deactivate previous active paper; keep inactive versions (sittings still reference them).
    await client.query(
      `UPDATE HRSYSTEM_assessments SET is_active = false
       WHERE job_id = $1 AND kind = $2 AND is_active = true`,
      [jobId, input.kind],
    );

    const assessment = await oneTx<{ id: string }>(
      client,
      `INSERT INTO HRSYSTEM_assessments (
         job_id, kind, title, instructions, duration_minutes, pass_score,
         require_camera, require_mic, require_fullscreen, require_screen_share, rules, is_active
       )
       VALUES ($1, $2::HRSYSTEM_assessment_kind, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
       RETURNING id`,
      [
        jobId,
        input.kind,
        input.title,
        input.instructions ?? null,
        input.duration_minutes,
        input.pass_score,
        input.require_camera ?? false,
        input.require_mic ?? false,
        input.require_fullscreen ?? false,
        input.require_screen_share ?? false,
        input.rules ?? null,
      ],
    );
    if (!assessment) throw new Error('Failed to create assessment');

    for (const [index, q] of input.questions.entries()) {
      await client.query(
        `INSERT INTO HRSYSTEM_assessment_questions (
           assessment_id, order_index, type, prompt, options, correct_key, language, max_score, rubric
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
        [
          assessment.id,
          index,
          q.type,
          q.prompt,
          JSON.stringify(q.options ?? []),
          q.correct_key ?? null,
          q.language ?? null,
          q.max_score,
          q.rubric ?? null,
        ],
      );
    }

    return { assessment_id: assessment.id, question_count: input.questions.length };
  });
}
