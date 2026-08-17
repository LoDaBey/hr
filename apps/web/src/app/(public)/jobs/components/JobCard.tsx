import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { date } from '@/lib/format';
import { EMPLOYMENT_TYPE, WORK_MODE, labelOf } from '@/lib/labels';
import type { PublicJobListItem } from '@/types/api';

export function JobCard({ job }: { job: PublicJobListItem }) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="sm">
        <Title order={2}>{job.title}</Title>
        <Group gap="xs">
          {job.department ? <Badge variant="light">{job.department}</Badge> : null}
          {job.location ? <Badge variant="outline">{job.location}</Badge> : null}
          {job.work_mode ? (
            <Badge variant="outline">{labelOf(WORK_MODE, job.work_mode)}</Badge>
          ) : null}
          {job.employment_type ? (
            <Badge variant="outline">{labelOf(EMPLOYMENT_TYPE, job.employment_type)}</Badge>
          ) : null}
        </Group>
        <Text size="sm" c="dimmed">
          Deadline: {date(job.application_deadline)}
        </Text>
        <Button
          component="a"
          href={`/jobs/${job.slug}`}
          className="cursor-pointer rounded-lg"
          aria-label={`View ${job.title} role`}
        >
          View role
        </Button>
      </Stack>
    </Card>
  );
}
