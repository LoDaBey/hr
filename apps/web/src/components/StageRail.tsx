'use client';

import { Box, Group, Text, Tooltip } from '@mantine/core';
import { PIPELINE_SEGMENTS, pipelineProgress } from '@/lib/pipeline-rail';
import { stageLabel } from '@/lib/labels';
import { density, palette } from '@/theme';
import type { Stage } from '@/types/domain';
import type { PipelineOutcome, StageRailSize } from '@/types/pipeline';

function fillColor(outcome: PipelineOutcome, isCurrent: boolean): string {
  if (!isCurrent) {
    if (outcome === 'hired') return palette.success;
    return palette.accent;
  }
  switch (outcome) {
    case 'rejected':
      return palette.danger;
    case 'withdrawn':
      return palette.warning;
    case 'hired':
      return palette.success;
    default:
      return palette.accent;
  }
}

export function StageRail({
  stage,
  size = 'sm',
  showLabels = false,
}: {
  stage: Stage;
  size?: StageRailSize;
  showLabels?: boolean;
}) {
  const progress = pipelineProgress(stage);
  const dims = density.stageRail[size];
  const label = stageLabel(stage);

  return (
    <Tooltip label={label} withArrow>
      <Box
        role="img"
        aria-label={`Pipeline: ${label}`}
        w="100%"
        maw={size === 'lg' ? undefined : 160}
      >
        <Group gap={dims.gap} wrap="nowrap" align="stretch">
          {PIPELINE_SEGMENTS.map((segment, index) => {
            const filled = index <= progress.segmentIndex;
            const isCurrent = index === progress.segmentIndex;
            const background = filled
              ? fillColor(progress.outcome, isCurrent)
              : `${palette.ink}18`;

            return (
              <Box key={segment.key} style={{ flex: 1, minWidth: 0 }}>
                <Box
                  h={dims.height}
                  style={{
                    borderRadius: dims.radius,
                    background,
                    opacity: filled && !isCurrent && progress.outcome !== 'hired' ? 0.55 : 1,
                  }}
                />
                {showLabels ? (
                  <Text
                    size="xs"
                    mt={density.stageRail.labelOffset}
                    c={isCurrent ? undefined : 'dimmed'}
                    fw={isCurrent ? 600 : 400}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {segment.label}
                  </Text>
                ) : null}
              </Box>
            );
          })}
        </Group>
      </Box>
    </Tooltip>
  );
}
