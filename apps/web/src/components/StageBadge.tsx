import { Badge } from '@mantine/core';
import { stageLabel } from '@/lib/labels';
import type { Stage } from '@/types/domain';

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge variant="light" color="accent" aria-label={`Stage: ${stageLabel(stage)}`}>
      {stageLabel(stage)}
    </Badge>
  );
}
