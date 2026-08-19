'use client';

import { CandidateEventLog, type EventLogItem } from './CandidateEventLog';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { time } from '@/lib/format';
import { emailTemplateLabel } from '@/lib/labels';
import { toastError, toastSuccess } from '@/lib/toast';
import type { Communication } from '@/types/domain';

function emailStatusDetail(comm: Communication): string {
  if (comm.status === 'SENT') {
    return comm.sent_at ? `Delivered ${time(comm.sent_at)}` : 'Delivered';
  }
  if (comm.status === 'PENDING') {
    const scheduled = new Date(comm.scheduled_for).getTime();
    if (scheduled > Date.now()) {
      return `Scheduled for ${time(comm.scheduled_for)}`;
    }
    return 'Sending shortly';
  }
  if (comm.status === 'FAILED') {
    return comm.last_error ? `Failed — ${comm.last_error}` : 'Failed — retry';
  }
  if (comm.status === 'CANCELLED') {
    return 'Cancelled — superseded by a newer invitation';
  }
  return comm.status;
}

export function CandidateEmailsSection({
  communications,
  onChanged,
}: {
  communications: Communication[];
  onChanged: () => void | Promise<void>;
}) {
  async function retryEmail(communicationId: string) {
    if (!communicationId) {
      toastError('Email id missing — refresh the page');
      return;
    }
    try {
      await api(`/api/hr/emails/${communicationId}/retry`, { method: 'POST' });
      toastSuccess('Email queued for retry');
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  if (communications.length === 0) {
    return null;
  }

  const items: EventLogItem[] = communications
    .filter((c) => Boolean(c.id))
    .map((c) => ({
      id: c.id,
      title: emailTemplateLabel(c.template_key),
      detail: `${emailStatusDetail(c)} · ${c.to_email}`,
      timestamp: c.created_at,
      actions:
        c.status === 'FAILED' ? (
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label={`Retry ${emailTemplateLabel(c.template_key)}`}
            size="xs"
            color="danger"
            variant="light"
            onClick={() => void retryEmail(c.id)}
          >
            Retry
          </MotionButton>
        ) : undefined,
    }));

  return <CandidateEventLog items={items} />;
}
