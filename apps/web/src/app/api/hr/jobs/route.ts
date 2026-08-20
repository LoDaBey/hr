import { z } from 'zod';
import { requireHr } from '@/lib/auth-hr';
import { errorCode, errorMessage } from '@/lib/errors';
import { jsonError, jsonOk } from '@/lib/http';
import { listHrJobs, createHrJob } from '@/lib/repos/hr-jobs';
import type { JobStatus } from '@/types/domain';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  title: z.string().trim().min(1),
  department: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  employment_type: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  work_mode: z.string().nullable().optional(),
  min_experience_years: z.number().nullable().optional(),
  required_skills: z.array(z.string()).optional(),
  preferred_skills: z.array(z.string()).optional(),
  education_requirement: z.string().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  languages: z.unknown().optional(),
  notice_period_max_days: z.number().int().nullable().optional(),
  ask_age: z.boolean().optional(),
  ask_military_status: z.boolean().optional(),
  ask_marital_status: z.boolean().optional(),
  hard_requirements: z.unknown().optional(),
  soft_requirements: z.unknown().optional(),
  screening_criteria: z.string().nullable().optional(),
  screening_weights: z.unknown().optional(),
  shortlist_threshold: z.number().int().min(0).max(100).nullable().optional(),
  cv_required: z.boolean().optional(),
  allow_reapply_days: z.number().int().optional(),
  assessment_invite_hours: z.number().int().optional(),
  techtest_invite_hours: z.number().int().optional(),
  application_deadline: z.string().nullable().optional(),
  vacancies: z.number().int().optional(),
  hiring_manager: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const status =
      statusParam && statusParam.trim() !== '' ? (statusParam as JobStatus) : null;
    const jobs = await listHrJobs(status);
    return jsonOk({ jobs });
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to list jobs');
  }
}

export async function POST(req: Request) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
    ];
    return jsonError(400, 'VALIDATION_FAILED', 'Validation failed', { fields });
  }

  try {
    const data = await createHrJob(parsed.data, { id: user.id, name: user.name });
    return jsonOk(data, 201);
  } catch (error) {
    console.error(error);
    if (errorCode(error) === 'VALIDATION_FAILED') {
      return jsonError(400, 'VALIDATION_FAILED', errorMessage(error, 'Validation failed'));
    }
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to create job');
  }
}
