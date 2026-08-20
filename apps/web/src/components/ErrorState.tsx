'use client';

import { Alert, Stack } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert color="danger" title={title} radius="md">
      <Stack gap="sm">
        {message}
        {onRetry ? (
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Retry"
            size="xs"
            variant="light"
            color="danger"
            onClick={onRetry}
          >
            Retry
          </MotionButton>
        ) : null}
      </Stack>
    </Alert>
  );
}
