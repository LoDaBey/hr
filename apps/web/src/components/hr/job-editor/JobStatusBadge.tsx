'use client';

import { Badge, Group, Text } from '@mantine/core';
import { JOB_STATUS, labelOf } from '@/lib/labels';
import type { JobStatus } from '@/types/domain';

const STATUS_COLOR: Record<JobStatus, string> = {
  DRAFT: 'ink',
  OPEN: 'success',
  PAUSED: 'warning',
  CLOSED: 'ink',
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">
        Status
      </Text>
      <Badge variant="light" color={STATUS_COLOR[status]} aria-label={`Job status ${labelOf(JOB_STATUS, status)}`}>
        {labelOf(JOB_STATUS, status)}
      </Badge>
    </Group>
  );
}
