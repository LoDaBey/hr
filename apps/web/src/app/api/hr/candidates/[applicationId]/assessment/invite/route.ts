import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { issueInvite } from '@/lib/pipeline/invites';
import type { HrInviteResult } from '@/types/api';

export const dynamic = 'force-dynamic';

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
    const result = await issueInvite(applicationId, {
      kind: 'ASSESSMENT',
      sendAt: new Date(),
      actor: { type: 'HR', id: user.id, label: user.name },
    });

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return jsonError(404, 'NOT_FOUND', 'Application not found');
      }
      if (result.reason === 'wrong_stage') {
        return jsonError(409, 'WRONG_STAGE', 'Application is not ready for an assessment invite');
      }
      return jsonError(404, 'NOT_FOUND', 'No assessment configured for this job');
    }

    const data: HrInviteResult = result.data;
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to invite candidate to assessment');
  }
}
