'use client';

import { Alert, Group, Loader, Text } from '@mantine/core';
import { palette } from '@/theme';

export function ScreeningInProgressPanel() {
  return (
    <Alert color="accent" variant="light">
      <Group gap="sm" wrap="nowrap">
        <Loader size="sm" color="accent" aria-label="Screening in progress" />
        <Text size="sm" style={{ color: palette.ink }}>
          Screening in progress. Results will appear here shortly.
        </Text>
      </Group>
    </Alert>
  );
}
