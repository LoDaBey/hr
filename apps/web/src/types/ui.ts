import type { ReactNode } from 'react';
import type {
  InterviewStatus,
  JobStatus,
  RecordingStatus,
  SittingStatus,
  Status,
} from '@/types/domain';
import type { PipelineOutcome } from '@/types/pipeline';

export type StatusTone = 'accent' | 'success' | 'danger' | 'warning' | 'ink' | 'muted';

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  count?: number;
  actions?: ReactNode;
  children?: ReactNode;
};

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type FilterBarProps = {
  children: ReactNode;
  chips?: FilterChip[];
  onClearAll?: () => void;
};

export type SectionCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  compact?: boolean;
};

export type MetricCardProps = {
  label: string;
  value: number | string;
  href?: string;
  emphasis?: 'primary' | 'default' | 'muted';
  tone?: StatusTone;
};

export type ScoreDisplayProps = {
  score: number | null;
  max?: number;
  label?: string;
  confidence?: number | null;
  recommendation?: string | null;
  recommendationTone?: StatusTone;
};

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  ariaLabel?: string;
};

export type JobStatusBadgeProps = {
  status: JobStatus;
  showLabel?: boolean;
};

export type ApplicationStatusBadgeProps = {
  status: Status;
};

export type SittingStatusBadgeProps = {
  status: SittingStatus;
};

export type InterviewStatusBadgeProps = {
  status: InterviewStatus;
};

export type RecordingStatusBadgeProps = {
  status: RecordingStatus;
};

export type ProctoringFlag = 'CLEAN' | 'MINOR_FLAGS' | 'REVIEW_RECORDING';

export type ProctoringBadgeProps = {
  flag: ProctoringFlag;
};

export type OutcomeToneMap = Record<PipelineOutcome, StatusTone>;
