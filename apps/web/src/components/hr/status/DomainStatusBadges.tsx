'use client';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { INTERVIEW_STATUS, RECORDING_STATUS, SITTING_STATUS, STATUS, labelOf } from '@/lib/labels';
import type {
  InterviewStatus,
  RecordingStatus,
  SittingStatus,
  Status,
} from '@/types/domain';
import type {
  ApplicationStatusBadgeProps,
  InterviewStatusBadgeProps,
  ProctoringBadgeProps,
  RecordingStatusBadgeProps,
  SittingStatusBadgeProps,
  StatusTone,
} from '@/types/ui';

const APP_STATUS_TONE: Record<Status, StatusTone> = {
  ACTIVE: 'accent',
  ON_HOLD: 'warning',
  REJECTED: 'danger',
  HIRED: 'success',
  WITHDRAWN: 'muted',
};

const SITTING_TONE: Record<SittingStatus, StatusTone> = {
  INVITED: 'accent',
  STARTED: 'warning',
  SUBMITTED: 'success',
  EXPIRED: 'danger',
  CANCELLED: 'muted',
};

const INTERVIEW_TONE: Record<InterviewStatus, StatusTone> = {
  SCHEDULED: 'accent',
  COMPLETED: 'success',
  CANCELLED: 'muted',
  NO_SHOW: 'danger',
};

const RECORDING_TONE: Record<RecordingStatus, StatusTone> = {
  NOT_REQUIRED: 'muted',
  UPLOAD_PENDING: 'warning',
  READY: 'success',
  FAILED: 'danger',
};

const PROCTORING_TONE: Record<ProctoringBadgeProps['flag'], StatusTone> = {
  CLEAN: 'success',
  MINOR_FLAGS: 'warning',
  REVIEW_RECORDING: 'danger',
};

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  return (
    <StatusBadge
      label={labelOf(STATUS, status)}
      tone={APP_STATUS_TONE[status]}
    />
  );
}

export function SittingStatusBadge({ status }: SittingStatusBadgeProps) {
  return (
    <StatusBadge
      label={labelOf(SITTING_STATUS, status)}
      tone={SITTING_TONE[status]}
    />
  );
}

export function InterviewStatusBadge({ status }: InterviewStatusBadgeProps) {
  return (
    <StatusBadge
      label={labelOf(INTERVIEW_STATUS, status)}
      tone={INTERVIEW_TONE[status]}
    />
  );
}

export function RecordingStatusBadge({ status }: RecordingStatusBadgeProps) {
  return (
    <StatusBadge
      label={labelOf(RECORDING_STATUS, status)}
      tone={RECORDING_TONE[status]}
    />
  );
}

export function ProctoringBadge({ flag }: ProctoringBadgeProps) {
  const labels = {
    CLEAN: 'Clean',
    MINOR_FLAGS: 'Minor flags',
    REVIEW_RECORDING: 'Review recording',
  } as const;
  return <StatusBadge label={labels[flag]} tone={PROCTORING_TONE[flag]} />;
}
