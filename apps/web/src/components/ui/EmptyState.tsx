'use client';

import { Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { EmptyStateProps } from '@/types/ui';
import { palette } from '@/theme';

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Stack
      align="center"
      gap="sm"
      py="xl"
      px="md"
      style={{ textAlign: 'center' }}
      role="status"
    >
      <ThemeIcon size={44} radius="md" variant="light" color="ink" aria-hidden>
        {icon ?? <IconInbox size={22} />}
      </ThemeIcon>
      <Text fw={600} size="md">
        {title}
      </Text>
      {description ? (
        <Text size="sm" maw={360} style={{ color: palette.muted }}>
          {description}
        </Text>
      ) : null}
      {action}
    </Stack>
  );
}
