import { ThemeIcon, Title, Text, Stack } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { density, palette, shadows } from '@/theme';

export function SuccessMessage() {
  return (
    <Stack
      gap="md"
      p="xl"
      maw={480}
      mx="auto"
      align="center"
      style={{
        textAlign: 'center',
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        boxShadow: shadows.md,
      }}
    >
      <ThemeIcon size={48} radius="md" color="success" variant="light" aria-hidden>
        <IconCircleCheck size={28} />
      </ThemeIcon>
      <Title
        order={1}
        style={{
          color: palette.ink,
          letterSpacing: density.titleLetterSpacing,
          fontSize: 'clamp(1.5rem, 3vw, 1.75rem)',
        }}
      >
        Application received
      </Title>
      <Text size="md" style={{ lineHeight: density.bodyLineHeight, color: palette.muted }}>
        Thank you. We have received your application and will review it shortly. You can close this
        page.
      </Text>
    </Stack>
  );
}
