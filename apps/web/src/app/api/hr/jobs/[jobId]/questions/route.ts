import { z } from 'zod';
import { requireHr } from '@/lib/auth-hr';
import { errorCode, errorMessage } from '@/lib/errors';
import { jsonError, jsonOk } from '@/lib/http';
import { replaceJobQuestions } from '@/lib/repos/hr-jobs';
import type { HrJobsQuestionsSetPayload } from '@/types/api';

export const dynamic = 'force-dynamic';

const questionSchema = z.object({
  id: z.string().optional(),
  order_index: z.number().int().optional(),
  label: z.string().min(1),
  key: z.string().min(1),
  type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'YEARS']),
  options: z.unknown().optional(),
  is_required: z.boolean().optional(),
});

const bodySchema = z.object({
  questions: z.array(questionSchema),
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
    const questions: HrJobsQuestionsSetPayload['questions'] = parsed.data.questions.map(
      (q, index) => ({
        order_index: q.order_index ?? index,
        label: q.label,
        key: q.key,
        type: q.type,
        options: q.options ?? [],
        is_required: q.is_required ?? true,
        id: q.id,
      }),
    );
    const data = await replaceJobQuestions(jobId, questions);
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
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to replace questions');
  }
}
