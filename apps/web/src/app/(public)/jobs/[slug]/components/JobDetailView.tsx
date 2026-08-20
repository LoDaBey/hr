import { Group, Stack, Text } from '@mantine/core';
import { density, palette } from '@/theme';
import type { PublicJobDetail } from '@/types/api';
import { JobHero } from './JobHero';
import { JobMetaCard } from './JobMetaCard';
import { JobSkills } from './JobSkills';

export function JobDetailView({ job }: { job: PublicJobDetail }) {
  return (
    <Stack gap="xl">
      <JobHero job={job} />
      <Group
        align="flex-start"
        gap="xl"
        wrap="wrap"
        preventGrowOverflow={false}
        style={{ alignItems: 'flex-start' }}
      >
        <Stack gap="xl" style={{ flex: '3 1 420px', minWidth: 0, maxWidth: '100%' }}>
          {job.description ? (
            <div>
              <Text fw={600} mb="sm" size="lg" style={{ color: palette.ink }}>
                About the role
              </Text>
              <Text
                size="md"
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: density.bodyLineHeight,
                  color: palette.ink,
                }}
              >
                {job.description}
              </Text>
            </div>
          ) : null}
          <JobSkills required={job.required_skills} preferred={job.preferred_skills} />
        </Stack>
        <div style={{ flex: '2 1 280px', minWidth: 260, maxWidth: '100%' }}>
          <JobMetaCard job={job} />
        </div>
      </Group>
    </Stack>
  );
}
