'use client';

import { Group, Text } from '@mantine/core';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { JOB_STATUS, labelOf } from '@/lib/labels';
import type { JobStatus } from '@/types/domain';
import type { JobStatusBadgeProps, StatusTone } from '@/types/ui';

const STATUS_TONE: Record<JobStatus, StatusTone> = {
  DRAFT: 'ink',
  OPEN: 'success',
  PAUSED: 'warning',
  CLOSED: 'muted',
};

export function JobStatusBadge({ status, showLabel = true }: JobStatusBadgeProps) {
  const label = labelOf(JOB_STATUS, status);
  const badge = (
    <StatusBadge
      label={label}
      tone={STATUS_TONE[status]}
      ariaLabel={`Job status ${label}`}
    />
  );

  if (!showLabel) return badge;

  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">
        Status
      </Text>
      {badge}
    </Group>
  );
}
