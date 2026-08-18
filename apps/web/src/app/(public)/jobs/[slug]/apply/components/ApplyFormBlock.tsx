import { Stack, Title } from '@mantine/core';
import { palette } from '@/theme';

export function ApplyFormBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="md">
      <Title order={3} style={{ color: palette.ink }}>
        {title}
      </Title>
      {children}
    </Stack>
  );
}
