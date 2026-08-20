'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Stack } from '@mantine/core';
import { JobWizard } from '@/components/hr/job-editor/JobWizard';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/SkeletonBlocks';
import { useHrJob } from '@/hooks/useHrJobs';

function NewJobWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const stepRaw = searchParams.get('step');
  const initialStep = stepRaw != null && stepRaw !== '' ? Number(stepRaw) : 0;
  const { data, error, isLoading } = useHrJob(jobId);

  if (jobId && isLoading) {
    return <PageSkeleton />;
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
        router.replace(`/hr/jobs/new?jobId=${id}&step=5`);
      }}
    />
  );
}

export function NewJobView() {
  return (
    <Stack gap="md">
      <PageHeader
        title="New job"
        subtitle="Configure the role, application form, screening, and assessments."
      />
      <Suspense fallback={<PageSkeleton />}>
        <NewJobWizardInner />
      </Suspense>
    </Stack>
  );
}
