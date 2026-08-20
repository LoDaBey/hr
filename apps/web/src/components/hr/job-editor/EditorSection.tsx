import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { palette, shadows } from '@/theme';

export function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Stack
      gap="md"
      p="md"
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        boxShadow: shadows.sm,
      }}
    >
      <div>
        <Title order={3} style={{ fontFamily: 'inherit', fontSize: '1.05rem' }}>
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed" mt={4}>
            {description}
          </Text>
        ) : null}
      </div>
      {children}
    </Stack>
  );
}
