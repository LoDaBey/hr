'use client';

import { Alert, Badge, Group, List, SimpleGrid, Stack, Text } from '@mantine/core';
import { ScoreDisplay } from '@/components/ui/ScoreDisplay';
import { stringList } from '@/lib/display';
import { HR_DECISION, RECOMMENDATION, labelOf } from '@/lib/labels';
import { palette } from '@/theme';
import type { HardRequirementFailure, Recommendation } from '@/types/domain';
import { HardRequirementFailuresPanel } from './HardRequirementFailuresPanel';
import { ScreeningInProgressPanel } from './ScreeningInProgressPanel';

type ScreeningData = {
  score: number | null;
  recommendation: Recommendation | null;
  confidence: number | null;
  strengths: unknown;
  weaknesses: unknown;
  missing_requirements: unknown;
  reasoning_summary: string | null;
  hr_decision: string | null;
  hard_requirement_failures?: HardRequirementFailure[];
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

export function ScreeningResultSection({
  screening,
  screeningPending = false,
}: {
  screening: ScreeningData | null;
  screeningPending?: boolean;
}) {
  if (screeningPending && !screening) {
    return <ScreeningInProgressPanel />;
  }

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
  const hardFailures = screening.hard_requirement_failures ?? [];
  const recommendationLabel = labelOf(
    RECOMMENDATION,
    screening.recommendation as Recommendation | null,
  );

  return (
    <Stack gap="lg">
      <HardRequirementFailuresPanel failures={hardFailures} />

      <Group align="flex-end" gap="lg" wrap="wrap">
        <ScoreDisplay
          score={screening.score}
          max={100}
          label="Screening score"
          confidence={screening.confidence}
          recommendation={recommendationLabel}
          recommendationTone={
            screening.recommendation === 'RECOMMEND_REJECT'
              ? 'danger'
              : screening.recommendation === 'STRONG_SHORTLIST'
                ? 'success'
                : screening.recommendation === 'MANUAL_REVIEW'
                  ? 'warning'
                  : 'accent'
          }
        />
        {screening.hr_decision ? (
          <Badge color="accent" variant="outline" size="md">
            HR override: {labelOf(HR_DECISION, screening.hr_decision)}
          </Badge>
        ) : null}
      </Group>

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
