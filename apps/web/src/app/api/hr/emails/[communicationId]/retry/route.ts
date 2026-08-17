import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { one } from '@/lib/db';
import type { Communication } from '@/types/domain';

export const dynamic = 'force-dynamic';

/** Reset a FAILED communication to PENDING so the email cron can retry it. */
export async function POST(
  _req: Request,
  context: { params: Promise<{ communicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const { communicationId } = await context.params;
    const row = await one<Communication>(
      `UPDATE communications
       SET status = 'PENDING',
           attempts = 0,
           last_error = NULL
       WHERE id = $1 AND status = 'FAILED'
       RETURNING *`,
      [communicationId],
    );
    if (!row) {
      return jsonError(404, 'NOT_FOUND', 'Failed communication not found');
    }
    return jsonOk({ status: row.status });
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to retry email');
  }
}
