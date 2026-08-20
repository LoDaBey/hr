'use client';

import { Badge, Group, Paper, Progress, Stack, Text } from '@mantine/core';
import {
  AssessmentQuestionInput,
} from '@/app/assessment/[token]/components/AssessmentQuestionInput';
import { density, palette } from '@/theme';
import type { CandidateQuestion } from '@/types/api';

export function TechInterviewQuestionCard({
  question,
  index,
  total,
  value,
  savedLabel,
  onChange,
  onPasteDetected,
}: {
  question: CandidateQuestion;
  index: number;
  total: number;
  value: unknown;
  savedLabel: string | null;
  onChange: (next: unknown) => void;
  onPasteDetected?: (charCount?: number) => void;
}) {
  const progress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const spoken = question.answer_mode === 'spoken';

  return (
    <Paper
      withBorder
      p="lg"
      maw={860}
      w="100%"
      mx="auto"
      radius={density.defaultRadius}
      style={{
        borderColor: `${palette.ink}14`,
        minHeight: 420,
        background: palette.paper,
      }}
    >
      <Stack gap="md" h="100%">
        <Stack gap={6}>
          <Group justify="space-between" align="center">
            <Text fw={600} style={{ color: palette.ink }}>
              Question {index + 1} of {total}
            </Text>
            {savedLabel ? (
              <Text size="xs" c="dimmed" aria-live="polite">
                {savedLabel}
              </Text>
            ) : null}
          </Group>
          <Progress
            value={progress}
            color="accent"
            size="sm"
            radius="xl"
            aria-label={`Progress: question ${index + 1} of ${total}`}
            styles={{ root: { backgroundColor: `${palette.ink}14` } }}
          />
        </Stack>

        <Text
          fw={600}
          style={{
            whiteSpace: 'pre-wrap',
            color: palette.ink,
            fontSize: spoken ? '1.25rem' : undefined,
            lineHeight: spoken ? 1.45 : undefined,
          }}
        >
          {question.prompt}
        </Text>

        {spoken ? (
          <Stack gap="sm" align="flex-start">
            <Text size="md" style={{ color: palette.muted }}>
              Answer out loud. Your recording is capturing this.
            </Text>
            <Badge color="accent" variant="light" size="lg" aria-live="polite">
              Listening — speak your answer
            </Badge>
          </Stack>
        ) : (
          <AssessmentQuestionInput
            question={question}
            value={value}
            onChange={onChange}
            onPasteDetected={onPasteDetected}
          />
        )}
      </Stack>
    </Paper>
  );
}
