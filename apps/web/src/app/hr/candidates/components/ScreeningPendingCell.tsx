'use client';

import { Group, Loader, Text } from '@mantine/core';
import { palette } from '@/theme';

export function ScreeningPendingCell() {
  return (
    <Group gap={6} wrap="nowrap">
      <Loader size="xs" color="accent" aria-hidden />
      <Text size="sm" style={{ color: palette.ink }}>
        Screening…
      </Text>
    </Group>
  );
}
