import { Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { date, money } from '@/lib/format';
import { palette, shadows } from '@/theme';
import type { PublicJobDetail } from '@/types/api';

export function JobMetaCard({ job }: { job: PublicJobDetail }) {
  const salary =
    job.salary_min != null || job.salary_max != null
      ? `${money(job.salary_min, job.currency ?? 'USD')}${
          job.salary_max != null ? ` – ${money(job.salary_max, job.currency ?? 'USD')}` : ''
        }`
      : 'Competitive';

  return (
    <Stack
      gap="lg"
      p="lg"
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        boxShadow: shadows.md,
        position: 'sticky',
        top: 24,
      }}
    >
      <div>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.06em' }}>
          Compensation
        </Text>
        <Text fw={600} mt={6} size="lg" style={{ color: palette.ink }}>
          {salary}
        </Text>
      </div>
      <div>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.06em' }}>
          Apply by
        </Text>
        <Text mt={6} style={{ color: palette.ink }}>
          {date(job.application_deadline)}
        </Text>
      </div>
      <MotionButton
        component="a"
        href={`/jobs/${job.slug}/apply`}
        className="cursor-pointer rounded-lg"
        aria-label={`Apply for ${job.title}`}
        fullWidth
        size="md"
      >
        Apply for this role
      </MotionButton>
    </Stack>
  );
}
