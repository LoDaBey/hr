import { Paper, Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { date, money } from '@/lib/format';
import { palette } from '@/theme';
import type { PublicJobDetail } from '@/types/api';

export function JobMetaCard({ job }: { job: PublicJobDetail }) {
  const salary =
    job.salary_min != null || job.salary_max != null
      ? `${money(job.salary_min, job.currency ?? 'USD')}${
          job.salary_max != null ? ` – ${money(job.salary_max, job.currency ?? 'USD')}` : ''
        }`
      : 'Competitive';

  return (
    <Paper
      p="xl"
      radius="lg"
      shadow="md"
      style={{
        background: '#FFFFFF',
        border: `1px solid ${palette.ink}12`,
        position: 'sticky',
        top: 32,
      }}
    >
      <Stack gap="lg">
        <div>
          <Text size="sm" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.08em' }}>
            Compensation
          </Text>
          <Text fw={600} mt={6} size="lg" style={{ color: palette.ink }}>
            {salary}
          </Text>
        </div>
        <div>
          <Text size="sm" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.08em' }}>
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
    </Paper>
  );
}
