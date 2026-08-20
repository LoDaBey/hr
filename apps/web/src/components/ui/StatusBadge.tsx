'use client';

import { Badge } from '@mantine/core';
import type { StatusBadgeProps, StatusTone } from '@/types/ui';

const TONE_COLOR: Record<StatusTone, string> = {
  accent: 'accent',
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  ink: 'ink',
  muted: 'gray',
};

export function StatusBadge({ label, tone = 'accent', ariaLabel }: StatusBadgeProps) {
  return (
    <Badge
      variant="light"
      color={TONE_COLOR[tone]}
      aria-label={ariaLabel ?? label}
    >
      {label}
    </Badge>
  );
}

export function toneColor(tone: StatusTone): string {
  return TONE_COLOR[tone];
}
