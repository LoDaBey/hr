import { Title, Text, Stack } from '@mantine/core';
import { density, palette } from '@/theme';

export function SuccessMessage() {
  return (
    <Stack gap="sm">
      <Title
        order={1}
        style={{
          color: palette.ink,
          letterSpacing: density.titleLetterSpacing,
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
        }}
      >
        Application received
      </Title>
      <Text size="lg" style={{ lineHeight: density.bodyLineHeight, color: palette.ink }}>
        Thank you. We have received your application and will review it shortly.
      </Text>
    </Stack>
  );
}
