'use client';

import { Paper, Stack, Text } from '@mantine/core';
import { datetime } from '@/lib/format';
import { density, palette } from '@/theme';
import type { CandidateAssessmentGetResult } from '@/types/api';

export function PreflightSessionInfo({
  data,
}: {
  data: CandidateAssessmentGetResult;
}) {
  return (
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{ borderColor: palette.border, background: palette.surface, height: '100%' }}
    >
      <Stack gap="sm">
        <Text size="sm">
          Time limit: <strong>{data.assessment.duration_minutes} minutes</strong> once you start ·{' '}
          {data.assessment.question_count} question
          {data.assessment.question_count === 1 ? '' : 's'}
        </Text>
        <Text size="sm" c="dimmed">
          Start before {datetime(data.invite_deadline)}. The clock does not start until you press
          Start.
        </Text>
        {data.assessment.instructions ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {data.assessment.instructions}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
