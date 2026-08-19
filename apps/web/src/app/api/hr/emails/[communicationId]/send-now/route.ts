import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { one } from '@/lib/db';
import { appendEvent } from '@/lib/repos/events';
import type { Communication, Stage } from '@/types/domain';

export const dynamic = 'force-dynamic';

/** Bump a queued email to send on the next cron pass. */
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
    const row = await one<
      Communication & {
        candidate_id: string | null;
        job_id: string | null;
        stage: Stage | null;
      }
    >(
      `UPDATE HRSYSTEM_communications c
       SET scheduled_for = now()
       FROM HRSYSTEM_applications a
       WHERE c.id = $1
         AND c.status = 'PENDING'
         AND c.application_id = a.id
       RETURNING c.*, a.candidate_id, a.job_id, a.stage`,
      [communicationId],
    );

    if (!row) {
      return jsonError(404, 'NOT_FOUND', 'Queued email not found');
    }

    if (row.application_id) {
      await appendEvent({
        application_id: row.application_id,
        candidate_id: row.candidate_id,
        job_id: row.job_id,
        event_type: 'EMAIL_SEND_NOW',
        from_stage: row.stage,
        to_stage: row.stage,
        actor_type: 'HR',
        actor_id: user.id,
        actor_label: user.name,
        payload: {
          communication_id: row.id,
          template_key: row.template_key,
        },
      });
    }

    return jsonOk({ status: row.status });
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to send email now');
  }
}
