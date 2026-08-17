import { Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { date, money } from '@/lib/format';
import { EMPLOYMENT_TYPE, WORK_MODE, labelOf } from '@/lib/labels';
import type { PublicJobDetail } from '@/types/api';

export function JobDetailView({ job }: { job: PublicJobDetail }) {
  return (
    <Stack gap="lg">
      <div>
        <Title order={1}>{job.title}</Title>
        <Group gap="xs" mt="sm">
          {job.department ? <Badge variant="light">{job.department}</Badge> : null}
          {job.location ? <Badge variant="outline">{job.location}</Badge> : null}
          {job.work_mode ? (
            <Badge variant="outline">{labelOf(WORK_MODE, job.work_mode)}</Badge>
          ) : null}
          {job.employment_type ? (
            <Badge variant="outline">{labelOf(EMPLOYMENT_TYPE, job.employment_type)}</Badge>
          ) : null}
        </Group>
      </div>
      {job.description ? <Text>{job.description}</Text> : null}
      {job.required_skills.length > 0 ? (
        <div>
          <Text fw={600} mb="xs">
            Required skills
          </Text>
          <Group gap="xs">
            {job.required_skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </Group>
        </div>
      ) : null}
      {job.preferred_skills.length > 0 ? (
        <div>
          <Text fw={600} mb="xs">
            Preferred skills
          </Text>
          <Group gap="xs">
            {job.preferred_skills.map((skill) => (
              <Badge key={skill} variant="light">
                {skill}
              </Badge>
            ))}
          </Group>
        </div>
      ) : null}
      <Text>
        Salary: {money(job.salary_min, job.currency ?? 'USD')}
        {job.salary_max != null ? ` – ${money(job.salary_max, job.currency ?? 'USD')}` : ''}
      </Text>
      <Text c="dimmed">Deadline: {date(job.application_deadline)}</Text>
      <Button
        component="a"
        href={`/jobs/${job.slug}/apply`}
        className="cursor-pointer rounded-lg"
        aria-label={`Apply for ${job.title}`}
      >
        Apply
      </Button>
    </Stack>
  );
}
