import { Badge, Group, Stack, Text } from '@mantine/core';
import { palette } from '@/theme';

export function JobSkills({
  required,
  preferred,
}: {
  required: string[];
  preferred: string[];
}) {
  if (required.length === 0 && preferred.length === 0) return null;

  return (
    <Stack gap="lg">
      {required.length > 0 ? (
        <div>
          <Text fw={600} mb="sm" style={{ color: palette.ink }}>
            Required skills
          </Text>
          <Group gap="xs">
            {required.map((skill) => (
              <Badge key={skill} color="accent" size="lg" variant="filled">
                {skill}
              </Badge>
            ))}
          </Group>
        </div>
      ) : null}
      {preferred.length > 0 ? (
        <div>
          <Text fw={600} mb="sm" style={{ color: palette.ink }}>
            Preferred skills
          </Text>
          <Group gap="xs">
            {preferred.map((skill) => (
              <Badge key={skill} color="accent" size="lg" variant="light">
                {skill}
              </Badge>
            ))}
          </Group>
        </div>
      ) : null}
    </Stack>
  );
}
