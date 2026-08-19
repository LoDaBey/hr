'use client';

import { Alert, Badge, Group, List, Stack, Text } from '@mantine/core';
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

function BulletList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <Text size="sm" fw={600} mb={4}>
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
    <Stack gap="md">
      <Group align="baseline" gap="md" wrap="wrap">
        <Group gap="xs" align="baseline">
          <Text
            fw={700}
            style={{ fontSize: '2.5rem', lineHeight: 1, color: palette.ink }}
          >
            {screening.score ?? '—'}
          </Text>
          <Text size="lg" c="dimmed">
            / 100
          </Text>
        </Group>
        <Badge color="accent" variant="light" size="lg">
          {recommendationLabel}
        </Badge>
        {screening.confidence != null ? (
          <Text size="sm" c="dimmed">
            Confidence {screening.confidence}
          </Text>
        ) : null}
        {screening.hr_decision ? (
          <Badge color="accent" variant="outline">
            HR override: {labelOf(HR_DECISION, screening.hr_decision)}
          </Badge>
        ) : null}
      </Group>

      <BulletList label="Strengths" items={strengths} />
      <BulletList label="Weaknesses" items={weaknesses} />
      <BulletList label="Missing" items={missing} />

      {screening.reasoning_summary ? (
        <Text style={{ lineHeight: 1.6 }}>{screening.reasoning_summary}</Text>
      ) : null}
    </Stack>
  );
}
