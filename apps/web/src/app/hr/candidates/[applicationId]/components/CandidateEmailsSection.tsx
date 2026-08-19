'use client';

import { Group, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { datetime } from '@/lib/format';
import { emailTemplateLabel } from '@/lib/labels';
import { toastError, toastSuccess } from '@/lib/toast';
import type { Communication } from '@/types/domain';

function emailStatusLine(comm: Communication): string {
  if (comm.status === 'SENT') {
    return comm.sent_at
      ? `Sent · ${datetime(comm.sent_at)}`
      : 'Sent';
  }
  if (comm.status === 'PENDING') {
    return 'Queued — sending within 5 minutes';
  }
  if (comm.status === 'FAILED') {
    return comm.last_error ? `Failed · ${comm.last_error}` : 'Failed';
  }
  if (comm.status === 'CANCELLED') {
    return 'Cancelled';
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
    try {
      await api(`/api/hr/emails/${communicationId}/retry`, { method: 'POST' });
      toastSuccess('Email queued for retry');
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  async function sendNow(communicationId: string) {
    try {
      await api(`/api/hr/emails/${communicationId}/send-now`, { method: 'POST' });
      toastSuccess('Email queued to send now');
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Send now failed');
    }
  }

  if (communications.length === 0) {
    return <Text c="dimmed">No emails queued for this candidate yet.</Text>;
  }

  return (
    <>
      {communications.map((c) => (
        <Group key={c.id} justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Text fw={500}>{emailTemplateLabel(c.template_key)}</Text>
            <Text size="sm" c="dimmed">
              {emailStatusLine(c)}
            </Text>
            <Text size="sm" c="dimmed">
              {c.to_email} · queued {datetime(c.created_at)}
            </Text>
          </div>
          <Group gap="xs">
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
          </Group>
        </Group>
      ))}
    </>
  );
}
