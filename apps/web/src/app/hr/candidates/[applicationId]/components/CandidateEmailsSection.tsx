'use client';

import dayjs from 'dayjs';
import { MotionButton } from '@/components/MotionButton';
import { CandidateEventLog, type EventLogItem } from './CandidateEventLog';
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
    const scheduled = dayjs(comm.scheduled_for);
    if (scheduled.isAfter(dayjs())) {
      return `Scheduled for ${time(comm.scheduled_for)}`;
    }
    return 'Sending shortly';
  }
  if (comm.status === 'FAILED') {
    return comm.last_error ?? 'Failed';
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

  async function sendNow(communicationId: string) {
    if (!communicationId) {
      toastError('Email id missing — refresh the page');
      return;
    }
    try {
      await api(`/api/hr/emails/${communicationId}/send-now`, { method: 'POST' });
      toastSuccess('Email sent');
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Send now failed');
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
      actions: (
        <>
          {c.status === 'PENDING' ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label={`Send ${emailTemplateLabel(c.template_key)} now`}
              size="xs"
              variant="light"
              color="accent"
              onClick={() => void sendNow(c.id)}
            >
              Send now
            </MotionButton>
          ) : null}
          {c.status === 'FAILED' ? (
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
          ) : null}
        </>
      ),
    }));

  return <CandidateEventLog items={items} />;
}
