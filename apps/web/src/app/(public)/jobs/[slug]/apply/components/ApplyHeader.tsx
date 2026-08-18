import { Stack, Text, Title } from '@mantine/core';
import { EMPLOYMENT_TYPE, WORK_MODE, labelOf } from '@/lib/labels';
import { density, palette } from '@/theme';
import type { PublicJobDetail } from '@/types/api';

export function ApplyHeader({ job }: { job: PublicJobDetail }) {
  const contextLine = [
    job.department,
    job.location,
    job.work_mode ? labelOf(WORK_MODE, job.work_mode) : null,
    job.employment_type ? labelOf(EMPLOYMENT_TYPE, job.employment_type) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Stack gap="xs">
      <Title
        order={1}
        style={{
          color: palette.ink,
          letterSpacing: density.titleLetterSpacing,
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
        }}
      >
        {job.title}
      </Title>
      <Text c="dimmed" size="sm">
        {contextLine || 'Complete the form below to apply. Fields marked required must be filled in.'}
      </Text>
    </Stack>
  );
}
