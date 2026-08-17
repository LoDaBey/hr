import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { sendInviteNow } from '@/lib/pipeline/invites';

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
    const result = await sendInviteNow(applicationId, 'ASSESSMENT', {
      type: 'HR',
      id: user.id,
      label: user.name,
    });

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return jsonError(404, 'NOT_FOUND', 'Application not found');
      }
      return jsonError(409, 'WRONG_STAGE', 'No pending assessment invite to send now');
    }

    return jsonOk({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to send assessment invite now');
  }
}
