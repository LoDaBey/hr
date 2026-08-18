import { Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

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
    <Stack gap="md">
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
  );
}
