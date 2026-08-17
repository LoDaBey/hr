import { STAGE } from '@/lib/labels';
import type {
  DashboardStageCol,
  PipelineProgress,
  PipelineSegment,
  PipelineSegmentKey,
} from '@/types/pipeline';
import type { Stage } from '@/types/domain';

/** Major hiring phases encoded by the stage rail (and dashboard columns). */
export const PIPELINE_SEGMENTS: PipelineSegment[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'recorded', label: 'Recorded' },
  { key: 'final', label: 'Final' },
  { key: 'hired', label: 'Hired' },
];

const SEGMENT_INDEX: Record<PipelineSegmentKey, number> = {
  applied: 0,
  screening: 1,
  assessment: 2,
  recorded: 3,
  final: 4,
  hired: 5,
};

export function pipelineProgress(stage: Stage): PipelineProgress {
  switch (stage) {
    case 'APPLICATION_RECEIVED':
    case 'CV_PROCESSING':
      return { segmentIndex: 0, segmentKey: 'applied', outcome: 'active' };

    case 'INITIAL_SCREENING':
    case 'INITIAL_SCREENING_REVIEW':
    case 'INITIAL_SHORTLISTED':
      return { segmentIndex: 1, segmentKey: 'screening', outcome: 'active' };
    case 'INITIAL_REJECTED':
      return { segmentIndex: 1, segmentKey: 'screening', outcome: 'rejected' };

    case 'TECH_ASSESSMENT_SENT':
    case 'TECH_ASSESSMENT_STARTED':
    case 'TECH_ASSESSMENT_SUBMITTED':
    case 'TECH_ASSESSMENT_EXPIRED':
    case 'TECH_ASSESSMENT_REVIEW':
    case 'TECH_SHORTLISTED':
      return { segmentIndex: 2, segmentKey: 'assessment', outcome: 'active' };
    case 'TECH_REJECTED':
      return { segmentIndex: 2, segmentKey: 'assessment', outcome: 'rejected' };

    case 'RECORDED_TECH_INVITED':
    case 'RECORDED_TECH_STARTED':
    case 'RECORDED_TECH_SUBMITTED':
    case 'RECORDED_TECH_EXPIRED':
    case 'RECORDED_TECH_REVIEW':
    case 'RECORDED_TECH_SHORTLISTED':
      return { segmentIndex: 3, segmentKey: 'recorded', outcome: 'active' };
    case 'RECORDED_TECH_REJECTED':
      return { segmentIndex: 3, segmentKey: 'recorded', outcome: 'rejected' };

    case 'FINAL_INTERVIEW_PENDING':
    case 'FINAL_INTERVIEW_SCHEDULED':
    case 'FINAL_INTERVIEW_COMPLETED':
    case 'SECOND_FINAL_INTERVIEW':
    case 'OFFER_PENDING':
      return { segmentIndex: 4, segmentKey: 'final', outcome: 'active' };
    case 'FINAL_REJECTED':
      return { segmentIndex: 4, segmentKey: 'final', outcome: 'rejected' };

    case 'HIRED':
      return { segmentIndex: SEGMENT_INDEX.hired, segmentKey: 'hired', outcome: 'hired' };

    case 'WITHDRAWN':
      return { segmentIndex: 0, segmentKey: 'applied', outcome: 'withdrawn' };

    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export const DASHBOARD_STAGE_COLS: DashboardStageCol[] = [
  { key: 'applied', label: STAGE.APPLICATION_RECEIVED, stage: 'APPLICATION_RECEIVED' },
  { key: 'screening', label: STAGE.INITIAL_SCREENING_REVIEW, stage: 'INITIAL_SCREENING_REVIEW' },
  { key: 'assessment', label: STAGE.TECH_ASSESSMENT_REVIEW, stage: 'TECH_ASSESSMENT_REVIEW' },
  { key: 'recorded', label: STAGE.RECORDED_TECH_REVIEW, stage: 'RECORDED_TECH_REVIEW' },
  { key: 'final_int', label: STAGE.FINAL_INTERVIEW_PENDING, stage: 'FINAL_INTERVIEW_PENDING' },
  { key: 'hired', label: STAGE.HIRED, stage: 'HIRED' },
  { key: 'rejected', label: 'Rejected', stage: null },
];
