'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Alert,
  Anchor,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { useHrErrors } from '@/hooks/useHrErrors';
import { api } from '@/lib/api';
import { datetime } from '@/lib/format';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { EmailDispatchResult } from '@/types/api';

export function ErrorsView({
  showDispatchButton,
  cronSecret,
}: {
  showDispatchButton: boolean;
  cronSecret: string | null;
}) {
  const { data, error, isLoading, mutate } = useHrErrors(false);
  const [dispatching, setDispatching] = useState(false);
  const [runningDeadline, setRunningDeadline] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);
  const [runningSweep, setRunningSweep] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function sendQueuedEmails() {
    if (!cronSecret) {
      toastError(
        'Set CRON_SECRET in .env.local to dispatch from this page.',
        'Cron secret missing',
      );
      return;
    }
    setDispatching(true);
    try {
      const result = await api<EmailDispatchResult>('/api/cron/email-dispatch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      toastSuccess(
        `Claimed ${result.claimed}, sent ${result.sent}, failed ${result.failed}.`,
        'Queued emails processed',
      );
      await mutate();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : 'Could not send queued emails.',
        'Dispatch failed',
      );
    } finally {
      setDispatching(false);
    }
  }

  async function runCron(
    path:
      | '/api/cron/deadline-monitor'
      | '/api/cron/interview-reminders'
      | '/api/cron/pipeline-sweep',
    label: string,
    setLoading: (v: boolean) => void,
  ) {
    if (!cronSecret) {
      toastError(
        'Set CRON_SECRET in .env.local to run crons from this page.',
        'Cron secret missing',
      );
      return;
    }
    setLoading(true);
    try {
      const result = await api<Record<string, number>>(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      toastSuccess(
        Object.entries(result)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · '),
        label,
      );
      await mutate();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Cron failed', `${label} failed`);
    } finally {
      setLoading(false);
    }
  }

  async function retryEmail(communicationId: string) {
    setRetryingId(communicationId);
    try {
      await api(`/api/hr/emails/${communicationId}/retry`, { method: 'POST' });
      toastSuccess(
        'Status reset to PENDING. Run Send queued emails to deliver it.',
        'Email re-queued',
      );
      await mutate();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : 'Could not retry email.',
        'Retry failed',
      );
    } finally {
      setRetryingId(null);
    }
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading errors" color="accent" />
      </Group>
    );
  }

  if (error || !data) {
    return <ErrorState title="Errors unavailable" message="Could not load workflow errors." />;
  }

  const { errors, failed_emails } = data;
  const empty = errors.length === 0 && failed_emails.length === 0;

  return (
    <Stack gap={density.sectionGap}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={1}>Errors</Title>
          <Text c="dimmed" mt={4}>
            Failed emails and open workflow errors. Retry a bounce, then drain the queue.
          </Text>
        </div>
        {showDispatchButton ? (
          <Group gap="sm">
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Send queued emails"
              color="accent"
              loading={dispatching}
              onClick={() => void sendQueuedEmails()}
            >
              Send queued emails
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Run deadline monitor"
              variant="default"
              loading={runningDeadline}
              onClick={() =>
                void runCron('/api/cron/deadline-monitor', 'Deadline monitor', setRunningDeadline)
              }
            >
              Run deadline monitor
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Run interview reminders"
              variant="default"
              loading={runningReminders}
              onClick={() =>
                void runCron(
                  '/api/cron/interview-reminders',
                  'Interview reminders',
                  setRunningReminders,
                )
              }
            >
              Run interview reminders
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Run pipeline sweep"
              variant="default"
              loading={runningSweep}
              onClick={() =>
                void runCron('/api/cron/pipeline-sweep', 'Pipeline sweep', setRunningSweep)
              }
            >
              Run pipeline sweep
            </MotionButton>
          </Group>
        ) : null}
      </Group>

      {empty ? (
        <Alert color="accent" variant="light" title="All clear">
          No failed emails or open workflow errors. When an invite bounces, it will show up here.
        </Alert>
      ) : null}

      <Paper withBorder radius={density.defaultRadius} p="md" style={{ borderColor: `${palette.ink}14` }}>
        <Title order={3} mb="sm">
          Failed emails
        </Title>
        {failed_emails.length === 0 ? (
          <Text c="dimmed">No failed emails. Nothing to retry.</Text>
        ) : (
          <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Template</Table.Th>
                <Table.Th>To</Table.Th>
                <Table.Th>Error</Table.Th>
                <Table.Th>When</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {failed_emails.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text fw={500}>{row.template_key}</Text>
                    {row.application_id ? (
                      <Anchor
                        component={Link}
                        href={`/hr/candidates/${row.application_id}`}
                        size="sm"
                        aria-label={`Open candidate for ${row.template_key}`}
                      >
                        View candidate
                      </Anchor>
                    ) : null}
                  </Table.Td>
                  <Table.Td>{row.to_email}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {row.last_error ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{datetime(row.created_at)}</Table.Td>
                  <Table.Td>
                    <MotionButton
                      className="cursor-pointer rounded-lg"
                      aria-label={`Retry email ${row.template_key} to ${row.to_email}`}
                      size="xs"
                      color="danger"
                      variant="light"
                      loading={retryingId === row.id}
                      onClick={() => void retryEmail(row.id)}
                    >
                      Retry
                    </MotionButton>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper withBorder radius={density.defaultRadius} p="md" style={{ borderColor: `${palette.ink}14` }}>
        <Title order={3} mb="sm">
          Workflow errors
        </Title>
        {errors.length === 0 ? (
          <Text c="dimmed">No open workflow errors.</Text>
        ) : (
          <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Action</Table.Th>
                <Table.Th>Node</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>When</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {errors.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.action ?? '—'}</Table.Td>
                  <Table.Td>{row.node ?? '—'}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={3}>
                      {row.error_message ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{datetime(row.created_at)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
