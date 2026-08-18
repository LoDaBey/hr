'use client';

import { useParams } from 'next/navigation';
import { Alert, Loader, Stack, Text } from '@mantine/core';
import { ApiError } from '@/lib/api';
import { PublicPageShell } from '../../../components/PublicPageShell';
import { usePublicJob } from '@/hooks/usePublicJob';
import { MotionButton } from '@/components/MotionButton';
import { ApplyForm } from './components/ApplyForm';
import { ClosedJobNotice } from '../components/ClosedJobNotice';

export default function JobApplyPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, error, isLoading, mutate } = usePublicJob(slug);

  if (isLoading) {
    return (
      <PublicPageShell wide>
        <Loader aria-label="Loading application form" />
      </PublicPageShell>
    );
  }

  if (error instanceof ApiError && (error.code === 'JOB_CLOSED' || error.code === 'DEADLINE_PASSED')) {
    return <ClosedJobNotice />;
  }

  if (error instanceof ApiError && error.code === 'NOT_FOUND') {
    return (
      <PublicPageShell wide>
        <Text>This role is not available.</Text>
      </PublicPageShell>
    );
  }

  if (error || !data) {
    return (
      <PublicPageShell wide>
        <Alert color="danger" title="Could not load this role">
          <Stack gap="sm">
            <Text>Please try again.</Text>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Retry loading the application form"
              onClick={() => mutate()}
            >
              Retry
            </MotionButton>
          </Stack>
        </Alert>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell wide>
      <ApplyForm job={data.job} questions={data.questions} />
    </PublicPageShell>
  );
}
