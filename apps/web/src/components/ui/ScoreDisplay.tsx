'use client';

import { Badge, Group, Progress, Stack, Text } from '@mantine/core';
import type { ScoreDisplayProps } from '@/types/ui';
import { toneColor } from '@/components/ui/StatusBadge';
import { palette } from '@/theme';

export function ScoreDisplay({
  score,
  max = 100,
  label,
  confidence,
  recommendation,
  recommendationTone = 'accent',
  size = 'md',
}: ScoreDisplayProps) {
  const scoreSize = size === 'xxl' ? '3.25rem' : '2rem';
  const maxSize = size === 'xxl' ? 'lg' : 'sm';

  return (
    <Stack gap="xs">
      <Group gap="md" align="flex-end" wrap="wrap">
        <div>
          {label ? (
            <Text size="xs" fw={600} tt="uppercase" style={{ color: palette.muted, letterSpacing: '0.04em' }}>
              {label}
            </Text>
          ) : null}
          <Group gap={8} align="baseline">
            <Text fw={700} style={{ fontSize: scoreSize, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {score ?? '—'}
            </Text>
            <Text size={maxSize} c="dimmed">
              / {max}
            </Text>
          </Group>
        </div>
        {recommendation ? (
          <Badge variant="light" color={toneColor(recommendationTone)} size="lg">
            {recommendation}
          </Badge>
        ) : null}
      </Group>
      {typeof confidence === 'number' ? (
        <Stack gap={4} maw={280}>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Confidence
            </Text>
            <Text size="sm" fw={600}>
              {confidence.toFixed(2)}
            </Text>
          </Group>
          <Progress value={Math.min(100, Math.max(0, confidence * 100))} color="accent" size="md" radius="sm" />
        </Stack>
      ) : null}
    </Stack>
  );
}
