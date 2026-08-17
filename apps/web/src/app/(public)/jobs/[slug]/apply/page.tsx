'use client';

import { useParams } from 'next/navigation';
import { Alert, Button, Container, Loader, Stack, Text } from '@mantine/core';
import { ApiError } from '@/lib/api';
import { density } from '@/theme';
import { usePublicJob } from '@/hooks/usePublicJob';
import { ApplyForm } from './components/ApplyForm';
import { ClosedJobNotice } from '../components/ClosedJobNotice';

export default function JobApplyPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, error, isLoading, mutate } = usePublicJob(slug);

  if (isLoading) {
    return (
      <Container py="xl">
        <Loader aria-label="Loading application form" />
      </Container>
    );
  }

  if (error instanceof ApiError && (error.code === 'JOB_CLOSED' || error.code === 'DEADLINE_PASSED')) {
    return <ClosedJobNotice />;
  }

  if (error instanceof ApiError && error.code === 'NOT_FOUND') {
    return (
      <Container py="xl">
        <Stack gap="md">
          <Text>This role is not available.</Text>
          <Button
            component="a"
            href="/jobs"
            className="cursor-pointer rounded-lg"
            aria-label="Back to open roles"
          >
            Back to open roles
          </Button>
        </Stack>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container py="xl">
        <Alert color="danger" title="Could not load this role">
          <Stack gap="sm">
            <Text>Please try again.</Text>
            <Button
              className="cursor-pointer rounded-lg"
              aria-label="Retry loading the application form"
              onClick={() => mutate()}
            >
              Retry
            </Button>
          </Stack>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size={density.contentMaxWidth} py="xl">
      <ApplyForm job={data.job} questions={data.questions} />
    </Container>
  );
}
