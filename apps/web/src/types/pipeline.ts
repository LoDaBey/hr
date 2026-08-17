import type { Stage } from '@/types/domain';

export type PipelineSegmentKey =
  | 'applied'
  | 'screening'
  | 'assessment'
  | 'recorded'
  | 'final'
  | 'hired';

export type PipelineOutcome = 'active' | 'rejected' | 'withdrawn' | 'hired';

export type PipelineSegment = {
  key: PipelineSegmentKey;
  label: string;
};

export type PipelineProgress = {
  segmentIndex: number;
  segmentKey: PipelineSegmentKey;
  outcome: PipelineOutcome;
};

export type DashboardStageCol = {
  key: string;
  label: string;
  stage: Stage | null;
};

export type StageRailSize = 'sm' | 'lg';
