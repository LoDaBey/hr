import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { sendInviteNow } from '@/lib/pipeline/invites';
import type { HrCommunicationDispatchResult, HrSendInviteNowResult } from '@/types/api';

export const dynamic = 'force-dynamic';
// maxDuration: keep in sync with ROUTE_BUDGET_SECONDS in src/lib/automation.ts
export const maxDuration = 60;

function mapCommunication(row: {
  id: string;
  status: HrCommunicationDispatchResult['status'];
  sent_at: string | null;
  scheduled_for: string;
  last_error: string | null;
}): HrCommunicationDispatchResult {
  return {
    id: row.id,
    status: row.status,
    sent_at: row.sent_at,
    scheduled_for: row.scheduled_for,
    last_error: row.last_error,
  };
}

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
    const result = await sendInviteNow(applicationId, 'TECH_TEST', {
      type: 'HR',
      id: user.id,
      label: user.name,
    });

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return jsonError(404, 'NOT_FOUND', 'Application not found');
      }
      return jsonError(409, 'WRONG_STAGE', 'No pending recorded tech test invite to send now');
    }

    const data: HrSendInviteNowResult = {
      communication: mapCommunication(result.communication),
      sitting: result.sitting,
      stage: result.stage,
    };

    return jsonOk(data);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Failed to send recorded tech test invite now';
    return jsonError(500, 'INTERNAL_ERROR', message);
  }
}
