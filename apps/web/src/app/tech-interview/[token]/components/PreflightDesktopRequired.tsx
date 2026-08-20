'use client';

import { Alert, Text } from '@mantine/core';

/** Blocking panel when screen share is required but getDisplayMedia is unavailable. */
export function PreflightDesktopRequired() {
  return (
    <Alert color="warning" title="Use a desktop or laptop">
      <Text size="sm">
        This session records your screen, which phones and tablets do not support. Open this link
        on a computer using Chrome, Edge or Firefox. Your invitation link still works — nothing has
        been used up.
      </Text>
    </Alert>
  );
}
