import { Stack, Text, Title } from '@mantine/core';
import { PublicPageShell } from '../../../components/PublicPageShell';
import { palette } from '@/theme';

export function ClosedJobNotice({ title }: { title?: string }) {
  return (
    <PublicPageShell>
      <Stack gap="md">
        <Title order={1} style={{ color: palette.ink }}>
          {title ?? 'Applications closed'}
        </Title>
        <Text>Applications for this role are closed.</Text>
      </Stack>
    </PublicPageShell>
  );
}
