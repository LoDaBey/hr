'use client';

import { Group, Text } from '@mantine/core';
import { palette } from '@/theme';

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRemaining(ms: number): string {
  return formatElapsed(ms);
}

function countdownColor(remainingMs: number | null): string {
  if (remainingMs == null) return palette.ink;
  if (remainingMs < 60_000) return palette.danger;
  if (remainingMs < 5 * 60_000) return palette.warning;
  return palette.ink;
}

export function TechInterviewHeader({
  jobTitle,
  assessmentTitle,
  remainingMs,
  recordingElapsedMs,
}: {
  jobTitle: string;
  assessmentTitle: string;
  remainingMs: number | null;
  recordingElapsedMs: number;
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: palette.paper,
        borderBottom: `1px solid ${palette.ink}14`,
        padding: '12px 16px',
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap" gap="md">
        <div style={{ minWidth: 0 }}>
          <Text size="sm" c="dimmed" truncate>
            {jobTitle}
          </Text>
          <Text fw={700} truncate style={{ color: palette.ink }}>
            {assessmentTitle}
          </Text>
        </div>

        <Group gap="md" align="center" wrap="nowrap">
          <Group
            gap={8}
            px={12}
            py={6}
            style={{
              borderRadius: 999,
              background: `${palette.danger}14`,
              border: `1px solid ${palette.danger}33`,
            }}
            aria-label="Recording in progress"
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: palette.danger,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <Text size="sm" fw={600} style={{ color: palette.danger }}>
              Recording
            </Text>
            <Text
              size="sm"
              style={{ color: palette.danger, fontVariantNumeric: 'tabular-nums' }}
              aria-label="Recording elapsed time"
            >
              {formatElapsed(recordingElapsedMs)}
            </Text>
          </Group>

          <Text
            fw={700}
            size="lg"
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: countdownColor(remainingMs),
              minWidth: 56,
              textAlign: 'right',
            }}
            aria-label="Time remaining"
          >
            {remainingMs == null ? '—' : formatRemaining(remainingMs)}
          </Text>
        </Group>
      </Group>
    </header>
  );
}

export { countdownColor, formatRemaining };
