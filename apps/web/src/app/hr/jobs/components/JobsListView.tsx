'use client';

import Link from 'next/link';
import { Group, Loader, Stack, Text, Title } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { ErrorState } from '@/components/ErrorState';
import { JobLinkCell } from '@/components/hr/job-editor/JobLinkCell';
import { MotionButton } from '@/components/MotionButton';
import { datetime } from '@/lib/format';
import { JOB_STATUS, labelOf } from '@/lib/labels';
import { useHrJobs } from '@/hooks/useHrJobs';
import type { JobStatus } from '@/types/domain';
import { JobRowActions } from './JobRowActions';

export function JobsListView() {
  const { data, error, isLoading, mutate } = useHrJobs();

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={1}>Jobs</Title>
        <MotionButton
          component={Link}
          href="/hr/jobs/new"
          className="cursor-pointer rounded-lg"
          aria-label="Create new job"
        >
          New job
        </MotionButton>
      </Group>

      {error ? (
        <ErrorState title="Could not load jobs" message={error.message} />
      ) : isLoading && !data ? (
        <Group justify="center" py="xl">
          <Loader aria-label="Loading jobs" />
        </Group>
      ) : (
        <DataTable
          withTableBorder
          borderRadius="sm"
          highlightOnHover
          minHeight={160}
          records={data?.jobs ?? []}
          idAccessor="id"
          columns={[
            {
              accessor: 'title',
              title: 'Title',
              render: (job) => (
                <Link href={`/hr/jobs/${job.id}`} aria-label={`Open job ${job.title}`}>
                  {job.title}
                </Link>
              ),
            },
            { accessor: 'slug', title: 'Slug' },
            {
              accessor: 'status',
              title: 'Status',
              render: (job) => labelOf(JOB_STATUS, job.status as JobStatus),
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
                job.assessment_question_count != null && job.assessment_duration_minutes != null
                  ? `Assessment: ${job.assessment_question_count} question${
                      job.assessment_question_count === 1 ? '' : 's'
                    }, ${job.assessment_duration_minutes} min`
                  : 'None',
            },
            {
              accessor: 'created_at',
              title: 'Created',
              render: (job) => datetime(job.created_at),
            },
            {
              accessor: 'actions',
              title: 'Actions',
              render: (job) => (
                <JobRowActions
                  jobId={job.id}
                  title={job.title}
                  onDeleted={() => void mutate()}
                />
              ),
            },
          ]}
          noRecordsText="No jobs yet — create one to publish a share link"
        />
      )}
      {!isLoading && data?.jobs.length === 0 ? (
        <Text c="dimmed">Create a job, add questions, then publish to get a candidate link.</Text>
      ) : null}
    </Stack>
  );
}
