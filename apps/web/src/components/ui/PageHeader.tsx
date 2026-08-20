'use client';

import { Group, Text, Title } from '@mantine/core';
import type { PageHeaderProps } from '@/types/ui';
import { density, palette } from '@/theme';

export function PageHeader({ title, subtitle, count, actions, children }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" mb={density.sectionGap}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Group gap="sm" align="baseline" wrap="wrap">
          <Title order={1} style={{ letterSpacing: density.titleLetterSpacing }}>
            {title}
          </Title>
          {typeof count === 'number' ? (
            <Text size="sm" c="dimmed" fw={500} component="span" aria-label={`${count} items`}>
              {count.toLocaleString()}
            </Text>
          ) : null}
        </Group>
        {subtitle ? (
          <Text size="sm" mt={4} style={{ color: palette.muted, maxWidth: 560 }}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </div>
      {actions ? (
        <Group gap="sm" wrap="wrap">
          {actions}
        </Group>
      ) : null}
    </Group>
  );
}
