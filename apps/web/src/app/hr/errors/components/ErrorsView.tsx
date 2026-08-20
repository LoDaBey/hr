'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Accordion,
  Anchor,
  Group,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { ErrorState } from '@/components/ErrorState';
import { MotionButton } from '@/components/MotionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/SkeletonBlocks';
import { SectionCard } from '@/components/ui/SectionCard';
import { useHrErrors } from '@/hooks/useHrErrors';
import { api } from '@/lib/api';
import { datetime } from '@/lib/format';
import { toastError, toastSuccess } from '@/lib/toast';
import { density } from '@/theme';
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
    return <PageSkeleton />;
  }

  if (error || !data) {
    return <ErrorState title="Errors unavailable" message="Could not load workflow errors." />;
  }

  const { errors, failed_emails, stuck_gradings, stuck_screenings } = data;
  const empty =
    errors.length === 0 &&
    failed_emails.length === 0 &&
    stuck_gradings.length === 0 &&
    stuck_screenings.length === 0;

  return (
    <Stack gap={density.sectionGap}>
      <PageHeader
        title="Errors"
        subtitle="Failed emails, open workflow errors, and candidates stuck awaiting grading or screening."
      />

      {showDispatchButton ? (
        <Accordion variant="contained" radius="md">
          <Accordion.Item value="ops">
            <Accordion.Control aria-label="Ops tools">Ops tools</Accordion.Control>
            <Accordion.Panel>
              <Group gap="sm" wrap="wrap">
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Send queued emails"
                  color="accent"
                  size="sm"
                  loading={dispatching}
                  onClick={() => void sendQueuedEmails()}
                >
                  Send queued emails
                </MotionButton>
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Run deadline monitor"
                  variant="default"
                  size="sm"
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
                  size="sm"
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
                  size="sm"
                  loading={runningSweep}
                  onClick={() =>
                    void runCron('/api/cron/pipeline-sweep', 'Pipeline sweep', setRunningSweep)
                  }
                >
                  Run pipeline sweep
                </MotionButton>
              </Group>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : null}

      {empty ? (
        <EmptyState
          title="All clear"
          description="No failed emails, open workflow errors, stuck sittings, or stuck screenings. When an invite bounces or grading or screening stalls, it will show up here."
        />
      ) : null}

      <SectionCard title={`Failed emails (${failed_emails.length})`}>
        {failed_emails.length === 0 ? (
          <Text c="dimmed" size="sm">
            No failed emails. Nothing to retry.
          </Text>
        ) : (
          <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
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
                    <Text fw={500} size="sm">
                      {row.template_key}
                    </Text>
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
                  <Table.Td>
                    <Text size="sm">{row.to_email}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {row.last_error ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {datetime(row.created_at)}
                    </Text>
                  </Table.Td>
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
      </SectionCard>

      <SectionCard title={`Workflow errors (${errors.length})`}>
        {errors.length === 0 ? (
          <Text c="dimmed" size="sm">
            No open workflow errors.
          </Text>
        ) : (
          <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
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
                  <Table.Td>
                    <Text size="sm" c="danger">
                      {row.action ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.node ?? '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={3}>
                      {row.error_message ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {datetime(row.created_at)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title={`Stuck gradings (${stuck_gradings.length})`}>
        {stuck_gradings.length === 0 ? (
          <Text c="dimmed" size="sm">
            No sittings stuck in a submitted stage without a successful grade.
          </Text>
        ) : (
          <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Candidate</Table.Th>
                <Table.Th>Kind</Table.Th>
                <Table.Th>Attempts</Table.Th>
                <Table.Th>Lease</Table.Th>
                <Table.Th>Last error</Table.Th>
                <Table.Th>Submitted</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stuck_gradings.map((row) => (
                <Table.Tr key={row.candidate_assessment_id}>
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {row.candidate_name ?? '—'}
                    </Text>
                    <Anchor
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      size="sm"
                      aria-label={`Open candidate ${row.candidate_name ?? row.application_id}`}
                    >
                      View candidate
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.kind}</Text>
                    <Text size="xs" c="dimmed">
                      {row.stage}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.grading_attempts}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.grading_claimed_at ? datetime(row.grading_claimed_at) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {row.last_error ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {datetime(row.submitted_at)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title={`Stuck screenings (${stuck_screenings.length})`}>
        {stuck_screenings.length === 0 ? (
          <Text c="dimmed" size="sm">
            No applications stuck awaiting screening without a result.
          </Text>
        ) : (
          <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Candidate</Table.Th>
                <Table.Th>Stage</Table.Th>
                <Table.Th>Attempts</Table.Th>
                <Table.Th>Lease</Table.Th>
                <Table.Th>Last error</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stuck_screenings.map((row) => (
                <Table.Tr key={row.application_id}>
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {row.candidate_name ?? '—'}
                    </Text>
                    <Anchor
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      size="sm"
                      aria-label={`Open candidate ${row.candidate_name ?? row.application_id}`}
                    >
                      View candidate
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.stage}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.screening_attempts}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.screening_claimed_at ? datetime(row.screening_claimed_at) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {row.last_error ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {datetime(row.created_at)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </SectionCard>
    </Stack>
  );
}
