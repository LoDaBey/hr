'use client';

import Link from 'next/link';
import { Anchor, Group, Stack, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { CandidateAvatar } from '@/components/hr/CandidateAvatar';
import { ApplicationStatusBadge } from '@/components/hr/status/DomainStatusBadges';
import { StageBadge } from '@/components/StageBadge';
import { StageRail } from '@/components/StageRail';
import { SectionCard } from '@/components/ui/SectionCard';
import { useHrCandidates } from '@/hooks/useHrCandidates';
import { datetime } from '@/lib/format';
import type { Stage, Status } from '@/types/domain';

export function DashboardCandidatesTable() {
  const { data, error, isLoading } = useHrCandidates({ page: 1, page_size: 15 });

  return (
    <SectionCard
      title="Candidates across all jobs"
      description="Recent applications from every open role."
      actions={
        <Anchor component={Link} href="/hr/candidates" size="sm" c="accent" aria-label="View all candidates">
          View all
        </Anchor>
      }
    >
      {error ? (
        <Text size="sm" c="dimmed">
          Could not load candidates.
        </Text>
      ) : (
        <DataTable
          className="hr-data-table"
          withTableBorder={false}
          highlightOnHover
          minHeight={120}
          fetching={isLoading}
          records={data?.rows ?? []}
          idAccessor="application_id"
          columns={[
            {
              accessor: 'full_name',
              title: 'Candidate',
              render: (row) => (
                <Group gap="sm" wrap="nowrap">
                  <CandidateAvatar name={row.full_name} size={28} />
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text
                      component={Link}
                      href={`/hr/candidates/${row.application_id}`}
                      aria-label={`Open candidate ${row.full_name}`}
                      fw={600}
                      size="sm"
                      c="accent"
                      style={{ textDecoration: 'none' }}
                      lineClamp={1}
                    >
                      {row.full_name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {row.email}
                    </Text>
                  </Stack>
                </Group>
              ),
            },
            {
              accessor: 'job_title',
              title: 'Job',
              render: (row) => (
                <Text size="sm" lineClamp={1}>
                  {row.job_title}
                </Text>
              ),
            },
            {
              accessor: 'stage',
              title: 'Stage',
              width: 180,
              render: (row) => (
                <Stack gap={4}>
                  <StageRail stage={row.stage as Stage} size="sm" />
                  <StageBadge stage={row.stage as Stage} />
                </Stack>
              ),
            },
            {
              accessor: 'status',
              title: 'Status',
              render: (row) => <ApplicationStatusBadge status={row.status as Status} />,
            },
            {
              accessor: 'screening_score',
              title: 'Score',
              width: 70,
              render: (row) => (
                <Text size="sm" fw={600}>
                  {row.screening_score ?? '—'}
                </Text>
              ),
            },
            {
              accessor: 'created_at',
              title: 'Applied',
              render: (row) => (
                <Text size="sm" c="dimmed">
                  {datetime(row.created_at)}
                </Text>
              ),
            },
          ]}
          noRecordsText="No candidates yet"
        />
      )}
    </SectionCard>
  );
}
