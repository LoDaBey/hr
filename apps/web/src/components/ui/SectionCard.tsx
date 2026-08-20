'use client';

import { Group, Stack, Text, Title } from '@mantine/core';
import type { SectionCardProps } from '@/types/ui';
import { palette, shadows } from '@/theme';

export function SectionCard({
  title,
  description,
  actions,
  children,
  compact = false,
}: SectionCardProps) {
  return (
    <Stack
      gap={compact ? 'sm' : 'md'}
      p={compact ? 'sm' : 'md'}
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        boxShadow: shadows.sm,
      }}
    >
      {title || actions ? (
        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
          <div style={{ minWidth: 0, flex: 1 }}>
            {title ? (
              <Title order={4} style={{ fontFamily: 'inherit', fontWeight: 600 }}>
                {title}
              </Title>
            ) : null}
            {description ? (
              <Text size="sm" mt={2} style={{ color: palette.muted }}>
                {description}
              </Text>
            ) : null}
          </div>
          {actions}
        </Group>
      ) : null}
      {children}
    </Stack>
  );
}
