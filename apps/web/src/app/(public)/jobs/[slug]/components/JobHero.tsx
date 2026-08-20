import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import { EMPLOYMENT_TYPE, WORK_MODE, labelOf } from '@/lib/labels';
import { density, palette } from '@/theme';
import type { PublicJobDetail } from '@/types/api';

export function JobHero({ job }: { job: PublicJobDetail }) {
  return (
    <Stack gap="md">
      <Text
        size="sm"
        fw={600}
        tt="uppercase"
        style={{ letterSpacing: '0.14em', color: palette.accent }}
      >
        {job.department || 'Open role'}
      </Text>
      <Title
        order={1}
        style={{
          fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
          lineHeight: 1.15,
          letterSpacing: density.titleLetterSpacing,
          color: palette.ink,
        }}
      >
        {job.title}
      </Title>
      <Group gap="xs">
        {job.location ? (
          <Badge variant="light" color="accent" size="lg">
            {job.location}
          </Badge>
        ) : null}
        {job.work_mode ? (
          <Badge variant="outline" color="accent" size="lg">
            {labelOf(WORK_MODE, job.work_mode)}
          </Badge>
        ) : null}
        {job.employment_type ? (
          <Badge variant="outline" color="ink" size="lg">
            {labelOf(EMPLOYMENT_TYPE, job.employment_type)}
          </Badge>
        ) : null}
      </Group>
    </Stack>
  );
}
