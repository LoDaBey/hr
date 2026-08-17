import 'server-only';
import { one, query } from '@/lib/db';
import type { PublicJobDetail, PublicJobListItem, PublicJobQuestion } from '@/types/api';
import type { Job, JobStatus } from '@/types/domain';

const PUBLIC_JOB_COLUMNS = `
  id, slug, title, department, description, employment_type, location, work_mode,
  required_skills, preferred_skills, salary_min, salary_max, currency,
  ask_age, ask_military_status, ask_marital_status, cv_required,
  application_deadline, status
`;

type PublicJobRow = PublicJobDetail & { status: JobStatus };

export type PublicJobLookup =
  | { ok: true; job: PublicJobDetail; questions: PublicJobQuestion[] }
  | {
      ok: false;
      code: 'NOT_FOUND' | 'JOB_CLOSED' | 'DEADLINE_PASSED';
      message: string;
    };

function toPublicJob(row: PublicJobRow): PublicJobDetail {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    department: row.department,
    description: row.description,
    employment_type: row.employment_type,
    location: row.location,
    work_mode: row.work_mode,
    required_skills: row.required_skills ?? [],
    preferred_skills: row.preferred_skills ?? [],
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    currency: row.currency,
    ask_age: row.ask_age,
    ask_military_status: row.ask_military_status,
    ask_marital_status: row.ask_marital_status,
    cv_required: row.cv_required,
    application_deadline: row.application_deadline,
  };
}

export async function findJobById(id: string): Promise<Job | null> {
  return one<Job>(`SELECT * FROM jobs WHERE id = $1`, [id]);
}

export async function findJobBySlug(slug: string): Promise<Job | null> {
  return one<Job>(`SELECT * FROM jobs WHERE slug = $1`, [slug]);
}

export async function listPublicJobs(): Promise<PublicJobListItem[]> {
  return query<PublicJobListItem>(
    `SELECT slug, title, department, location, work_mode, employment_type, application_deadline
     FROM jobs
     WHERE status = 'OPEN'
       AND (application_deadline IS NULL OR application_deadline > now())
     ORDER BY created_at DESC`,
  );
}

export async function listJobQuestions(jobId: string): Promise<PublicJobQuestion[]> {
  return query<PublicJobQuestion>(
    `SELECT id, key, label, type, options, is_required, order_index
     FROM job_questions
     WHERE job_id = $1
     ORDER BY order_index`,
    [jobId],
  );
}

export async function getPublicJob(slug: string): Promise<PublicJobLookup> {
  const row = await one<PublicJobRow>(
    `SELECT ${PUBLIC_JOB_COLUMNS}
     FROM jobs
     WHERE slug = $1`,
    [slug],
  );
  if (!row || row.status === 'DRAFT') {
    return { ok: false, code: 'NOT_FOUND', message: 'Job not found' };
  }
  if (row.status !== 'OPEN') {
    return { ok: false, code: 'JOB_CLOSED', message: 'This role is no longer open' };
  }
  if (row.application_deadline && new Date(row.application_deadline).getTime() <= Date.now()) {
    return { ok: false, code: 'DEADLINE_PASSED', message: 'The application deadline has passed' };
  }

  const questions = await listJobQuestions(row.id);
  return { ok: true, job: toPublicJob(row), questions };
}

export async function listOpenJobs(): Promise<Job[]> {
  return query<Job>(
    `SELECT * FROM jobs
     WHERE status = 'OPEN'
       AND (application_deadline IS NULL OR application_deadline > now())
     ORDER BY created_at DESC`,
  );
}

export async function listJobs(status: JobStatus | null = null): Promise<Job[]> {
  return query<Job>(
    `SELECT * FROM jobs
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC`,
    [status],
  );
}
