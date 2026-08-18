'use client';

import { useRouter } from 'next/navigation';
import { Group, Loader, Stack, Title } from '@mantine/core';
import { JobWizard } from '@/components/hr/job-editor/JobWizard';
import { ErrorState } from '@/components/ErrorState';
import { useHrJob } from '@/hooks/useHrJobs';

export function EditJobView({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useHrJob(jobId);

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading job" color="accent" />
      </Group>
    );
  }

  if (error || !data) {
    return <ErrorState title="Job not found" message="This job could not be loaded." />;
  }

  return (
    <Stack gap="md">
      <Title order={1}>Edit job</Title>
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
