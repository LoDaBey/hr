import { z } from 'zod';
import { requireHr } from '@/lib/auth-hr';
import { errorCode, errorMessage } from '@/lib/errors';
import { jsonError, jsonOk } from '@/lib/http';
import { replaceJobAssessment } from '@/lib/repos/hr-jobs';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  kind: z.enum(['ASSESSMENT', 'TECH_TEST']),
  title: z.string().min(1),
  instructions: z.string().nullable().optional(),
  duration_minutes: z.number().int().positive(),
  pass_score: z.number().int().min(0),
  require_camera: z.boolean().optional(),
  require_mic: z.boolean().optional(),
  require_fullscreen: z.boolean().optional(),
  require_screen_share: z.boolean().optional(),
  rules: z.string().nullable().optional(),
  questions: z
    .array(
      z.object({
        type: z.enum([
          'MCQ',
          'TEXT',
          'CODING',
          'SQL',
          'DEBUGGING',
          'ARCHITECTURE',
          'SCENARIO',
          'FILE',
        ]),
        prompt: z.string().min(1),
        options: z.unknown().optional(),
        correct_key: z.string().optional(),
        language: z.string().nullable().optional(),
        max_score: z.number().int().positive(),
        rubric: z.string().optional(),
        answer_mode: z.enum(['written', 'spoken']).optional(),
      }),
    )
    .min(1),
});

export async function PUT(
  req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
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

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
    ];
    return jsonError(400, 'VALIDATION_FAILED', 'Validation failed', { fields });
  }

  try {
    const { jobId } = await context.params;
    const data = await replaceJobAssessment(jobId, { ...parsed.data, job_id: jobId });
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    const code = errorCode(error);
    if (code === 'NOT_FOUND') {
      return jsonError(404, 'NOT_FOUND', errorMessage(error, 'Job not found'));
    }
    if (code === 'VALIDATION_FAILED') {
      return jsonError(400, 'VALIDATION_FAILED', errorMessage(error, 'Validation failed'));
    }
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to replace assessment');
  }
}
