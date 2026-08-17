'use client';

import { Alert, Button, Stack } from '@mantine/core';

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
    <Alert color="red" title={title}>
      <Stack gap="sm">
        {message}
        {onRetry ? (
          <Button
            className="cursor-pointer rounded-lg"
            aria-label="Retry"
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </Stack>
    </Alert>
  );
}
