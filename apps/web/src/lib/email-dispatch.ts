import 'server-only';
import { runAutomation } from '@/lib/automation';
import { renderTemplate } from '@/lib/email-render';
import {
  claimPendingCommunications,
  markCommunicationFailed,
  markCommunicationSent,
} from '@/lib/repos/communications';
import { findEmailTemplateByKey } from '@/lib/repos/email-templates';
import { insertWorkflowError } from '@/lib/repos/workflow-errors';
import type { EmailDispatchResult, EmailSendData } from '@/types/api';
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

/** Claim and send a batch of PENDING communications. Never throws on a single bad row. */
export async function dispatchPendingEmails(limit = 20): Promise<EmailDispatchResult> {
  const claimed = await claimPendingCommunications(limit);
  let sent = 0;
  let failed = 0;

  for (const row of claimed) {
    const outcome = await dispatchOne(row);
    if (outcome === 'sent') sent += 1;
    else failed += 1;
  }

  return { claimed: claimed.length, sent, failed };
}
