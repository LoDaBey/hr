'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Group, Loader, Stack, Title } from '@mantine/core';
import { JobWizard } from '@/components/hr/job-editor/JobWizard';
import { ErrorState } from '@/components/ErrorState';
import { useHrJob } from '@/hooks/useHrJobs';

function NewJobWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const stepRaw = searchParams.get('step');
  const initialStep = stepRaw != null && stepRaw !== '' ? Number(stepRaw) : 0;
  const { data, error, isLoading } = useHrJob(jobId);

  if (jobId && isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader aria-label="Loading draft job" color="accent" />
      </Group>
    );
  }

  if (jobId && (error || !data)) {
    return (
      <ErrorState
        title="Draft not found"
        message="This draft could not be loaded. Start a new job or open it from the jobs list."
      />
    );
  }

  return (
    <JobWizard
      mode="create"
      initial={data}
      initialStep={Number.isFinite(initialStep) ? initialStep : 0}
      onDraftProgress={(id, step) => {
        router.replace(`/hr/jobs/new?jobId=${id}&step=${step}`);
      }}
      onSaved={(id) => {
        router.push(`/hr/jobs/${id}`);
        router.refresh();
      }}
      onPublished={(id) => {
        router.replace(`/hr/jobs/new?jobId=${id}&step=4`);
      }}
    />
  );
}

export function NewJobView() {
  return (
    <Stack gap="md">
      <Title order={1}>New job</Title>
      <Suspense
        fallback={
          <Group justify="center" py="xl">
            <Loader aria-label="Loading job wizard" color="accent" />
          </Group>
        }
      >
        <NewJobWizardInner />
      </Suspense>
    </Stack>
  );
}
