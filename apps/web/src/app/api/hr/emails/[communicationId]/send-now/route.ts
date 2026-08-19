import { requireHr } from '@/lib/auth-hr';
import { one } from '@/lib/db';
import { dispatchCommunicationById } from '@/lib/email-dispatch';
import { jsonError, jsonOk } from '@/lib/http';
import { findCommunicationById } from '@/lib/repos/communications';
import { appendEvent } from '@/lib/repos/events';
import type { Stage } from '@/types/domain';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const existing = await findCommunicationById(communicationId);
    if (!existing) {
      return jsonError(404, 'NOT_FOUND', 'Queued email not found');
    }
    if (existing.status !== 'PENDING') {
      return jsonError(409, 'WRONG_STAGE', 'Email is not queued for sending');
    }

    if (existing.application_id) {
      const application = await one<{
        candidate_id: string;
        job_id: string;
        stage: Stage;
      }>(
        `SELECT candidate_id, job_id, stage
         FROM HRSYSTEM_applications
         WHERE id = $1`,
        [existing.application_id],
      );

      if (application) {
        await appendEvent({
          application_id: existing.application_id,
          candidate_id: application.candidate_id,
          job_id: application.job_id,
          event_type: 'EMAIL_SEND_NOW',
          from_stage: application.stage,
          to_stage: application.stage,
          actor_type: 'HR',
          actor_id: user.id,
          actor_label: user.name,
          payload: {
            communication_id: existing.id,
            template_key: existing.template_key,
          },
        });
      }
    }

    const outcome = await dispatchCommunicationById(communicationId);
    if (outcome.outcome === 'not_found') {
      return jsonError(404, 'NOT_FOUND', 'Queued email not found');
    }
    if (outcome.outcome === 'failed') {
      return jsonError(
        500,
        'INTERNAL_ERROR',
        outcome.communication.last_error ?? 'Email could not be sent',
      );
    }
    if (outcome.outcome === 'not_pending') {
      return jsonError(409, 'WRONG_STAGE', 'Email is not queued for sending');
    }

    return jsonOk({ communication: outcome.communication });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Failed to send email now';
    return jsonError(500, 'INTERNAL_ERROR', message);
  }
}
