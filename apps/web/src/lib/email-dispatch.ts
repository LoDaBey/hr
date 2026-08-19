import 'server-only';
import { runAutomation } from '@/lib/automation';
import { renderTemplate } from '@/lib/email-render';
import {
  claimCommunicationForSend,
  claimPendingCommunications,
  findCommunicationById,
  markCommunicationFailed,
  markCommunicationSent,
} from '@/lib/repos/communications';
import { findEmailTemplateByKey } from '@/lib/repos/email-templates';
import { insertWorkflowError } from '@/lib/repos/workflow-errors';
import type { EmailDispatchResult, EmailSendData, HrCommunicationDispatchResult } from '@/types/api';
import type { Communication } from '@/types/domain';

function variablesRecord(variables: unknown): Record<string, unknown> {
  if (typeof variables === 'object' && variables !== null && !Array.isArray(variables)) {
    return variables as Record<string, unknown>;
  }
  return {};
}

function fromName(variables: unknown): string {
  const vars = variablesRecord(variables);
  const name = vars.hr_name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return 'HR Team';
}

function toDispatchResult(row: Communication): HrCommunicationDispatchResult {
  return {
    id: row.id,
    status: row.status,
    sent_at: row.sent_at,
    scheduled_for: row.scheduled_for,
    last_error: row.last_error,
  };
}

async function dispatchOne(row: Communication): Promise<'sent' | 'failed'> {
  try {
    const template = await findEmailTemplateByKey(row.template_key);
    if (!template) {
      throw new Error(`Unknown email template: ${row.template_key}`);
    }

    const subject = renderTemplate(template.subject, row.variables);
    const html = renderTemplate(template.body_html, row.variables);

    const result = await runAutomation<EmailSendData>(
      'email.send',
      {
        to: row.to_email,
        subject,
        html,
        from_name: fromName(row.variables),
      },
      {},
    );

    if (!result.ok) {
      throw new Error(result.error.message || 'email.send failed');
    }

    const messageId = result.data.message_id;
    if (!messageId) {
      throw new Error('email.send returned no message_id');
    }

    await markCommunicationSent(row.id, messageId);
    return 'sent';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'email.send failed';
    console.error(`email-dispatch failed for ${row.id}:`, message);

    const updated = await markCommunicationFailed(row.id, message);
    if (updated?.status === 'FAILED') {
      await insertWorkflowError({
        action: 'email.send',
        node: 'email-dispatch',
        error_message: message,
        application_id: row.application_id,
        candidate_id: row.candidate_id,
        input_ref: {
          communication_id: row.id,
          template_key: row.template_key,
          to_email: row.to_email,
        },
      });
    }
    return 'failed';
  }
}

/** Send one communication row that was already claimed (attempts incremented). */
export async function dispatchClaimedCommunication(
  row: Communication,
): Promise<'sent' | 'failed'> {
  return dispatchOne(row);
}

export type DispatchCommunicationByIdResult =
  | { outcome: 'sent' | 'failed'; communication: HrCommunicationDispatchResult }
  | { outcome: 'not_found' }
  | { outcome: 'not_pending' | 'already_sent'; communication: HrCommunicationDispatchResult };

/** Claim and send one queued communication immediately. */
export async function dispatchCommunicationById(
  id: string,
): Promise<DispatchCommunicationByIdResult> {
  const claimed = await claimCommunicationForSend(id);
  if (!claimed) {
    const existing = await findCommunicationById(id);
    if (!existing) return { outcome: 'not_found' };
    const snapshot = toDispatchResult(existing);
    if (existing.status === 'SENT') {
      return { outcome: 'already_sent', communication: snapshot };
    }
    return { outcome: 'not_pending', communication: snapshot };
  }

  const result = await dispatchClaimedCommunication(claimed);
  const refreshed = await findCommunicationById(id);
  if (!refreshed) return { outcome: 'not_found' };
  return { outcome: result, communication: toDispatchResult(refreshed) };
}

/** Claim and send a batch of PENDING communications. Never throws on a single bad row. */
export async function dispatchPendingEmails(limit = 20): Promise<EmailDispatchResult> {
  const claimed = await claimPendingCommunications(limit);
  let sent = 0;
  let failed = 0;

  for (const row of claimed) {
    const outcome = await dispatchClaimedCommunication(row);
    if (outcome === 'sent') sent += 1;
    else failed += 1;
  }

  return { claimed: claimed.length, sent, failed };
}
