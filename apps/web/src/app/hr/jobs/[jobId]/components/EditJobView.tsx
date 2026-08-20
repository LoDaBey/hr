'use client';

import { useRouter } from 'next/navigation';
import { Stack } from '@mantine/core';
import { JobWizard } from '@/components/hr/job-editor/JobWizard';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/SkeletonBlocks';
import { useHrJob } from '@/hooks/useHrJobs';

export function EditJobView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useHrJob(jobId);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error || !data) {
    return <ErrorState title="Job not found" message="This job could not be loaded." />;
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="Edit job"
        subtitle={data.job.title}
      />
      <JobWizard
        key={jobId}
        mode="edit"
        initial={data}
        onSaved={async () => {
          await mutate();
          router.refresh();
        }}
        onPublished={async () => {
          await mutate();
          router.refresh();
        }}
      />
    </Stack>
  );
}
