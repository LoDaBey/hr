'use client';

import Link from 'next/link';
import { Anchor, Group, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core';
import useSWR from 'swr';
import { ScheduleForm } from './ScheduleForm';
import { ErrorState } from '@/components/ErrorState';
import { api } from '@/lib/api';
import { datetime } from '@/lib/format';
import { density, palette } from '@/theme';
import type { HrInterviewsListResult } from '@/types/api';

export function InterviewsView() {
  const { data, error, isLoading, mutate } = useSWR<HrInterviewsListResult>(
    '/api/hr/interviews',
    (url: string) => api<HrInterviewsListResult>(url),
  );

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading interviews" color="accent" />
      </Group>
    );
  }

  if (error || !data) {
    return <ErrorState title="Interviews unavailable" message="Could not load interviews." />;
  }

  return (
    <Stack gap={density.sectionGap}>
      <div>
        <Title order={1}>Interviews</Title>
        <Text c="dimmed" mt={4}>
          Upcoming sessions in the next 14 days, and candidates waiting to be scheduled.
        </Text>
      </div>

      <Paper withBorder p="md" radius={density.defaultRadius} style={{ borderColor: `${palette.ink}14` }}>
        <Title order={3} mb="sm">
          Upcoming
        </Title>
        {data.upcoming.length === 0 ? (
          <Text c="dimmed">No interviews in the next 14 days.</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Candidate</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Round</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.upcoming.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    {datetime(row.scheduled_at)}
                    <Text size="xs" c="dimmed">
                      {row.timezone}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Anchor
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      aria-label={`Open ${row.candidate_name}`}
                    >
                      {row.candidate_name}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{row.job_title}</Table.Td>
                  <Table.Td>{row.round_no}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Paper withBorder p="md" radius={density.defaultRadius} style={{ borderColor: `${palette.ink}14` }}>
        <Title order={3} mb="sm">
          Awaiting scheduling
        </Title>
        {data.awaiting.length === 0 ? (
          <Text c="dimmed">Nobody is waiting for a final interview slot.</Text>
        ) : (
          <Stack gap="lg">
            {data.awaiting.map((row) => (
              <Paper
                key={row.application_id}
                withBorder
                p="md"
                radius={density.defaultRadius}
                style={{ borderColor: `${palette.ink}14` }}
              >
                <Stack gap="sm">
                  <div>
                    <Anchor
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      fw={600}
                      aria-label={`Open ${row.candidate_name}`}
                    >
                      {row.candidate_name}
                    </Anchor>
                    <Text size="sm" c="dimmed">
                      {row.job_title} · {row.candidate_email}
                    </Text>
                  </div>
                  <ScheduleForm
                    applicationId={row.application_id}
                    roundNo={row.stage === 'SECOND_FINAL_INTERVIEW' ? 2 : 1}
                    onScheduled={() => void mutate()}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
