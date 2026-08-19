import { requireHr } from '@/lib/auth-hr';
import { dispatchCommunicationById } from '@/lib/email-dispatch';
import { jsonError, jsonOk } from '@/lib/http';
import { one } from '@/lib/db';
import { appendEvent } from '@/lib/repos/events';
import type { Communication, Stage } from '@/types/domain';

export const dynamic = 'force-dynamic';

/** Send a queued communication immediately — no waiting for cron. */
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
    if (!communicationId || communicationId === 'undefined') {
      return jsonError(400, 'VALIDATION_FAILED', 'Communication id is required');
    }

    const row = await one<Communication>(
      `UPDATE HRSYSTEM_communications
       SET scheduled_for = now()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [communicationId],
    );

    if (!row) {
      return jsonError(404, 'NOT_FOUND', 'Queued email not found');
    }

    if (row.application_id) {
      const application = await one<{
        candidate_id: string;
        job_id: string;
        stage: Stage;
      }>(
        `SELECT candidate_id, job_id, stage
         FROM HRSYSTEM_applications
         WHERE id = $1`,
        [row.application_id],
      );

      if (application) {
        await appendEvent({
          application_id: row.application_id,
          candidate_id: application.candidate_id,
          job_id: application.job_id,
          event_type: 'EMAIL_SEND_NOW',
          from_stage: application.stage,
          to_stage: application.stage,
          actor_type: 'HR',
          actor_id: user.id,
          actor_label: user.name,
          payload: {
            communication_id: row.id,
            template_key: row.template_key,
          },
        });
      }
    }

    const outcome = await dispatchCommunicationById(row.id);
    if (outcome === 'not_found') {
      return jsonError(404, 'NOT_FOUND', 'Queued email not found');
    }
    if (outcome === 'failed') {
      return jsonError(500, 'DISPATCH_FAILED', 'Email could not be sent');
    }

    const refreshed = await one<Communication>(
      `SELECT * FROM HRSYSTEM_communications WHERE id = $1`,
      [row.id],
    );

    return jsonOk({ status: refreshed?.status ?? row.status });
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to send email now');
  }
}
