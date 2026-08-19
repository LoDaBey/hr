'use client';

import { Alert, Badge, Group, List, SimpleGrid, Stack, Text } from '@mantine/core';
import { stringList } from '@/lib/display';
import { HR_DECISION, RECOMMENDATION, labelOf } from '@/lib/labels';
import { palette } from '@/theme';
import type { Recommendation } from '@/types/domain';

type ScreeningData = {
  score: number | null;
  recommendation: Recommendation | null;
  confidence: number | null;
  strengths: unknown;
  weaknesses: unknown;
  missing_requirements: unknown;
  reasoning_summary: string | null;
  hr_decision: string | null;
};

function BulletList({
  label,
  items,
  accentColor,
}: {
  label: string;
  items: string[];
  accentColor?: 'warning' | 'accent' | 'ink';
}) {
  const labelColor = accentColor === 'warning' ? palette.warning : palette.ink;

  return (
    <div>
      <Text size="sm" fw={700} mb={6} style={{ color: labelColor }}>
        {label}
      </Text>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          —
        </Text>
      ) : (
        <List size="sm" spacing={4}>
          {items.map((item) => (
            <List.Item key={item}>{item}</List.Item>
          ))}
        </List>
      )}
    </div>
  );
}

export function ScreeningResultSection({ screening }: { screening: ScreeningData | null }) {
  if (!screening) {
    return (
      <Alert color="ink" variant="light">
        Screening has not completed yet. Refresh shortly, or review the CV manually.
      </Alert>
    );
  }

  const strengths = stringList(screening.strengths);
  const weaknesses = stringList(screening.weaknesses);
  const missing = stringList(screening.missing_requirements);
  const recommendationLabel = labelOf(
    RECOMMENDATION,
    screening.recommendation as Recommendation | null,
  );

  return (
    <Stack gap="lg">
      <Group align="flex-end" gap="lg" wrap="wrap">
        <Group gap="sm" align="flex-end">
          <Text
            fw={700}
            style={{
              fontSize: '3.5rem',
              lineHeight: 0.9,
              color: palette.ink,
              letterSpacing: '-0.03em',
            }}
          >
            {screening.score ?? '—'}
          </Text>
          <Text size="xl" c="dimmed" pb={6}>
            / 100
          </Text>
          <Badge color="accent" variant="light" size="xl" pb={4}>
            {recommendationLabel}
          </Badge>
        </Group>
        {screening.hr_decision ? (
          <Badge color="accent" variant="outline" size="md">
            HR override: {labelOf(HR_DECISION, screening.hr_decision)}
          </Badge>
        ) : null}
      </Group>

      {screening.confidence != null ? (
        <Text size="xs" c="dimmed">
          Confidence {screening.confidence}
        </Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <BulletList label="Missing" items={missing} accentColor="warning" />
        <BulletList label="Strengths" items={strengths} />
        <BulletList label="Weaknesses" items={weaknesses} />
      </SimpleGrid>

      {screening.reasoning_summary ? (
        <Text style={{ lineHeight: 1.65, color: palette.ink }}>{screening.reasoning_summary}</Text>
      ) : null}
    </Stack>
  );
}
