import { requireHr } from '@/lib/auth-hr';
import { gradeSittingNow } from '@/lib/pipeline/grade-now';
import { jsonError, jsonOk } from '@/lib/http';
import type { HrGradeNowResult } from '@/types/api';

export const dynamic = 'force-dynamic';
// maxDuration: keep in sync with ROUTE_BUDGET_SECONDS in src/lib/automation.ts
export const maxDuration = 60;

export async function POST(
  _req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  const { applicationId } = await context.params;

  try {
    const result = await gradeSittingNow({
      applicationId,
      kind: 'ASSESSMENT',
      actorLabel: `${user.name} — Grade now`,
      actorId: user.id,
    });

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return jsonError(404, 'NOT_FOUND', 'No assessment sitting found for this candidate');
      }
      if (result.reason === 'not_submitted') {
        return jsonError(409, 'WRONG_STAGE', 'Assessment is not awaiting grading');
      }
      if (result.reason === 'already_graded') {
        return jsonError(409, 'ALREADY_GRADED', 'Assessment is already graded');
      }
      return jsonError(409, 'WRONG_STAGE', 'Assessment is not awaiting grading');
    }

    const data: HrGradeNowResult = { sitting_id: result.sitting_id };
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Grading failed';
    return jsonError(500, 'GRADING_FAILED', message);
  }
}
