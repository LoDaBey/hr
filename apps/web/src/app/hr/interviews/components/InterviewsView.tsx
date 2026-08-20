'use client';

import Link from 'next/link';
import { Accordion, Anchor, Group, Stack, Table, Text } from '@mantine/core';
import useSWR from 'swr';
import { ScheduleForm } from './ScheduleForm';
import { ErrorState } from '@/components/ErrorState';
import { CandidateAvatar } from '@/components/hr/CandidateAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/SkeletonBlocks';
import { SectionCard } from '@/components/ui/SectionCard';
import { MotionButton } from '@/components/MotionButton';
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
    return <PageSkeleton />;
  }

  if (error || !data) {
    return <ErrorState title="Interviews unavailable" message="Could not load interviews." />;
  }

  return (
    <Stack gap={density.sectionGap}>
      <PageHeader
        title="Interviews"
        subtitle="Upcoming sessions in the next 14 days, and candidates waiting to be scheduled."
      />

      <SectionCard title="Upcoming" description={`${data.upcoming.length} in the next 14 days`}>
        {data.upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming interviews"
            description="Scheduled final interviews will appear here."
            action={
              <MotionButton
                component={Link}
                href="/hr/candidates"
                variant="light"
                className="cursor-pointer rounded-lg"
                aria-label="Browse candidates"
                size="sm"
              >
                Browse candidates
              </MotionButton>
            }
          />
        ) : (
          <Table highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Candidate</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Round</Table.Th>
                <Table.Th>Meeting link</Table.Th>
                <Table.Th>Interviewer email</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.upcoming.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {datetime(row.scheduled_at)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {row.timezone}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <CandidateAvatar name={row.candidate_name} size={28} />
                      <Anchor
                        component={Link}
                        href={`/hr/candidates/${row.application_id}`}
                        aria-label={`Open ${row.candidate_name}`}
                        size="sm"
                        fw={600}
                        c="accent"
                      >
                        {row.candidate_name}
                      </Anchor>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.job_title}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.round_no}</Text>
                  </Table.Td>
                  <Table.Td>
                    {row.meeting_url ? (
                      <Anchor
                        href={row.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        c="accent"
                        lineClamp={1}
                        maw={220}
                        aria-label={`Open meeting link for ${row.candidate_name}`}
                      >
                        {row.meeting_url}
                      </Anchor>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {row.interviewer_email ? (
                      <Anchor
                        href={`mailto:${row.interviewer_email}`}
                        size="sm"
                        c="accent"
                        aria-label={`Email interviewer ${row.interviewer_email}`}
                      >
                        {row.interviewer_email}
                      </Anchor>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </SectionCard>

      <SectionCard
        title="Awaiting scheduling"
        description={`${data.awaiting.length} candidate${data.awaiting.length === 1 ? '' : 's'}`}
      >
        {data.awaiting.length === 0 ? (
          <Text c="dimmed" size="sm">
            Nobody is waiting for a final interview slot.
          </Text>
        ) : (
          <Accordion variant="separated" radius="md" styles={{ item: { borderColor: palette.border } }}>
            {data.awaiting.map((row) => (
              <Accordion.Item key={row.application_id} value={row.application_id}>
                <Accordion.Control aria-label={`Schedule interview for ${row.candidate_name}`}>
                  <Group gap="sm" wrap="nowrap">
                    <CandidateAvatar name={row.candidate_name} size={28} />
                    <div>
                      <Text size="sm" fw={600}>
                        {row.candidate_name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {row.job_title} · {row.candidate_email}
                      </Text>
                    </div>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Anchor
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      size="sm"
                      aria-label={`Open profile for ${row.candidate_name}`}
                    >
                      Open candidate profile
                    </Anchor>
                    <ScheduleForm
                      applicationId={row.application_id}
                      roundNo={row.stage === 'SECOND_FINAL_INTERVIEW' ? 2 : 1}
                      onScheduled={() => void mutate()}
                    />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </SectionCard>
    </Stack>
  );
}
