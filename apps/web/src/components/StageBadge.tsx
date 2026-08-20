'use client';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { pipelineProgress } from '@/lib/pipeline-rail';
import { stageLabel } from '@/lib/labels';
import type { Stage } from '@/types/domain';
import type { PipelineOutcome } from '@/types/pipeline';
import type { OutcomeToneMap, StatusTone } from '@/types/ui';

const OUTCOME_TONE: OutcomeToneMap = {
  active: 'accent',
  rejected: 'danger',
  hired: 'success',
  withdrawn: 'warning',
};

export function stageTone(stage: Stage): StatusTone {
  const { outcome } = pipelineProgress(stage);
  return OUTCOME_TONE[outcome as PipelineOutcome];
}

export function StageBadge({ stage }: { stage: Stage }) {
  const label = stageLabel(stage);
  return (
    <StatusBadge
      label={label}
      tone={stageTone(stage)}
      ariaLabel={`Stage: ${label}`}
    />
  );
}
