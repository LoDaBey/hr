'use client';

import { use } from 'react';
import { Alert, Group, Loader, Stack, Text, Title } from '@mantine/core';
import useSWR from 'swr';
import { AssessmentSitting } from './components/AssessmentSitting';
import { ApiError, api } from '@/lib/api';
import { palette } from '@/theme';
import type { CandidateAssessmentGetResult } from '@/types/api';

function TokenMessage({ title, message }: { title: string; message: string }) {
  return (
    <Stack
      gap="md"
      maw={480}
      mx="auto"
      py="xl"
      px="md"
      align="center"
      style={{ minHeight: '60vh', background: palette.paper }}
    >
      <Title order={1} ta="center" style={{ color: palette.ink }}>
        {title}
      </Title>
      <Text ta="center" c="dimmed">
        {message}
      </Text>
    </Stack>
  );
}

export default function AssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const { data, error, isLoading } = useSWR<CandidateAssessmentGetResult>(
    token ? `/api/assessment/${encodeURIComponent(token)}` : null,
    (url: string) => api<CandidateAssessmentGetResult>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  if (isLoading) {
    return (
      <Group justify="center" py="xl" style={{ minHeight: '60vh', background: palette.paper }}>
        <Loader aria-label="Loading assessment" color="accent" />
      </Group>
    );
  }

  if (error) {
    const code = error instanceof ApiError ? error.code : '';
    if (code === 'ALREADY_SUBMITTED') {
      return (
        <TokenMessage
          title="Already submitted"
          message="You have already submitted this assessment. Thank you — our team will review it."
        />
      );
    }
    if (code === 'TOKEN_EXPIRED') {
      return (
        <TokenMessage
          title="Link expired"
          message="The window to start this assessment has closed. Contact us if you had a technical problem."
        />
      );
    }
    return (
      <TokenMessage
        title="Link not valid"
        message="This assessment link is not valid or is no longer active. Ask the hiring team to send a new one."
      />
    );
  }

  if (!data) {
    return (
      <Group justify="center" py="xl" style={{ background: palette.paper }}>
        <Alert color="danger">Could not load this assessment.</Alert>
      </Group>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: palette.paper }}>
      <AssessmentSitting token={token} initial={data} />
    </div>
  );
}
