'use client';

import Link from 'next/link';
import { Stack, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { ErrorState } from '@/components/ErrorState';
import { JobLinkCell } from '@/components/hr/job-editor/JobLinkCell';
import { JobStatusBadge } from '@/components/hr/job-editor/JobStatusBadge';
import { MotionButton } from '@/components/MotionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/SkeletonBlocks';
import { datetime } from '@/lib/format';
import { useHrJobs } from '@/hooks/useHrJobs';
import type { JobStatus } from '@/types/domain';
import { JobRowActions } from './JobRowActions';

export function JobsListView() {
  const { data, error, isLoading, mutate } = useHrJobs();

  return (
    <Stack gap="md">
      <PageHeader
        title="Jobs"
        count={data?.jobs.length}
        subtitle="Create roles, configure assessments, and share application links."
        actions={
          <MotionButton
            component={Link}
            href="/hr/jobs/new"
            className="cursor-pointer rounded-lg"
            aria-label="Create new job"
          >
            New job
          </MotionButton>
        }
      />

      {error ? (
        <ErrorState title="Could not load jobs" message={error.message} />
      ) : isLoading && !data ? (
        <TableSkeleton rows={5} />
      ) : !isLoading && (data?.jobs.length ?? 0) === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Create a job, add questions, then publish to get a candidate link."
          action={
            <MotionButton
              component={Link}
              href="/hr/jobs/new"
              className="cursor-pointer rounded-lg"
              aria-label="Create new job"
            >
              New job
            </MotionButton>
          }
        />
      ) : (
        <DataTable
          className="hr-data-table"
          withTableBorder
          borderRadius="md"
          highlightOnHover
          minHeight={160}
          records={data?.jobs ?? []}
          idAccessor="id"
          columns={[
            {
              accessor: 'title',
              title: 'Title',
              render: (job) => (
                <Text
                  component={Link}
                  href={`/hr/jobs/${job.id}`}
                  aria-label={`Open job ${job.title}`}
                  fw={600}
                  size="sm"
                  c="accent"
                  style={{ textDecoration: 'none' }}
                >
                  {job.title}
                </Text>
              ),
            },
            {
              accessor: 'slug',
              title: 'Slug',
              render: (job) => (
                <Text size="sm" c="dimmed" lineClamp={1} maw={180}>
                  {job.slug}
                </Text>
              ),
            },
            {
              accessor: 'status',
              title: 'Status',
              render: (job) => (
                <JobStatusBadge status={job.status as JobStatus} showLabel={false} />
              ),
            },
            { accessor: 'department', title: 'Department' },
            {
              accessor: 'link',
              title: 'Link',
              render: (job) => (
                <JobLinkCell status={job.status as JobStatus} slug={job.slug} />
              ),
            },
            {
              accessor: 'assessment',
              title: 'Assessment',
              render: (job) =>
                job.assessment_question_count != null && job.assessment_duration_minutes != null ? (
                  <Text size="sm">
                    {job.assessment_question_count}q · {job.assessment_duration_minutes}m
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    None
                  </Text>
                ),
            },
            {
              accessor: 'created_at',
              title: 'Created',
              render: (job) => (
                <Text size="sm" c="dimmed">
                  {datetime(job.created_at)}
                </Text>
              ),
            },
            {
              accessor: 'actions',
              title: '',
              render: (job) => (
                <JobRowActions
                  jobId={job.id}
                  title={job.title}
                  onDeleted={() => void mutate()}
                />
              ),
            },
          ]}
          noRecordsText=""
        />
      )}
    </Stack>
  );
}
