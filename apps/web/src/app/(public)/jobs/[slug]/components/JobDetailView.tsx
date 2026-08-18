import { SimpleGrid, Stack, Text } from '@mantine/core';
import { density, palette } from '@/theme';
import type { PublicJobDetail } from '@/types/api';
import { JobHero } from './JobHero';
import { JobMetaCard } from './JobMetaCard';
import { JobSkills } from './JobSkills';

export function JobDetailView({ job }: { job: PublicJobDetail }) {
  return (
    <Stack gap={48}>
      <JobHero job={job} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={40} style={{ alignItems: 'start' }}>
        <Stack gap="xl">
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
        <JobMetaCard job={job} />
      </SimpleGrid>
    </Stack>
  );
}
