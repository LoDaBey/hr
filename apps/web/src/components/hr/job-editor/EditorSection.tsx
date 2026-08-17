import { Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { density, palette } from '@/theme';

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
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{ borderColor: `${palette.ink}14` }}
    >
      <Stack gap="sm">
        <div>
          <Title order={3}>{title}</Title>
          {description ? (
            <Text size="sm" c="dimmed" mt="xs">
              {description}
            </Text>
          ) : null}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}
