import type {
  ActorType,
  AssessmentKind,
  CommStatus,
  EmploymentType,
  HardFailAction,
  InterviewStatus,
  JobQuestionType,
  JobCurrency,
  JobDepartment,
  JobStatus,
  ParseStatus,
  ProctoringSeverity,
  QuestionType,
  Recommendation,
  RecordingStatus,
  Role,
  SittingStatus,
  Stage,
  Status,
  WorkMode,
} from '@/types/domain';
import type { HrDecisionValue } from '@/types/api';

export const EMPLOYMENT_TYPE: Record<EmploymentType, string> = {
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  CONTRACT: 'Contract',
  INTERN: 'Internship',
};

export const WORK_MODE: Record<WorkMode, string> = {
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  ONSITE: 'On-site',
};

export const STAGE: Record<Stage, string> = {
  APPLICATION_RECEIVED: 'Applied',
  CV_PROCESSING: 'Processing CV',
  INITIAL_SCREENING: 'Screening',
  INITIAL_SCREENING_REVIEW: 'Screening review',
  INITIAL_SHORTLISTED: 'Shortlisted',
  INITIAL_REJECTED: 'Rejected',
  TECH_ASSESSMENT_SENT: 'Assessment sent',
  TECH_ASSESSMENT_STARTED: 'Assessment started',
  TECH_ASSESSMENT_SUBMITTED: 'Assessment submitted',
  TECH_ASSESSMENT_EXPIRED: 'Assessment expired',
  TECH_ASSESSMENT_REVIEW: 'Assessment review',
  TECH_SHORTLISTED: 'Assessment shortlisted',
  TECH_REJECTED: 'Assessment rejected',
  RECORDED_TECH_INVITED: 'Recorded invite sent',
  RECORDED_TECH_STARTED: 'Recorded started',
  RECORDED_TECH_SUBMITTED: 'Recorded submitted',
  RECORDED_TECH_EXPIRED: 'Recorded expired',
  RECORDED_TECH_REVIEW: 'Recorded review',
  RECORDED_TECH_SHORTLISTED: 'Recorded shortlisted',
  RECORDED_TECH_REJECTED: 'Recorded rejected',
  FINAL_INTERVIEW_PENDING: 'Final interview pending',
  FINAL_INTERVIEW_SCHEDULED: 'Final interview scheduled',
  FINAL_INTERVIEW_COMPLETED: 'Final interview completed',
  SECOND_FINAL_INTERVIEW: 'Second final interview',
  OFFER_PENDING: 'Offer pending',
  HIRED: 'Hired',
  FINAL_REJECTED: 'Final rejected',
  WITHDRAWN: 'Withdrawn',
};

export const RECOMMENDATION: Record<Recommendation, string> = {
  STRONG_SHORTLIST: 'Strong match',
  SHORTLIST: 'Good match',
  MANUAL_REVIEW: 'Needs review',
  RECOMMEND_REJECT: 'Weak match',
};

export const STATUS: Record<Status, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  REJECTED: 'Rejected',
  HIRED: 'Hired',
  WITHDRAWN: 'Withdrawn',
};

export const JOB_STATUS: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
};

export const JOB_DEPARTMENT: Record<JobDepartment, string> = {
  'Social Media': 'Social Media',
  'Data Analysis & Monitoring': 'Data Analysis & Monitoring',
  'Human Resources': 'Human Resources',
  'Digital Engagement': 'Digital Engagement',
  'Web Development': 'Web Development',
  QC: 'QC',
  Productions: 'Productions',
};

export const JOB_CURRENCY: Record<JobCurrency, string> = {
  EGP: 'EGP',
  USD: 'USD',
  AED: 'Dirham',
};

export function normalizeJobCurrency(value: string | null | undefined): string {
  if (value == null || value === '') return 'USD';
  if (value === 'Dirham') return 'AED';
  return value;
}

export function withCurrentSelectOption<T extends string>(
  options: Array<{ value: T; label: string }>,
  current: string | null | undefined,
): Array<{ value: string; label: string }> {
  const mapped = options.map((option) => ({ value: option.value, label: option.label }));
  if (!current) return mapped;
  if (mapped.some((option) => option.value === current)) return mapped;
  return [{ value: current, label: current }, ...mapped];
}

export const ROLE: Record<Role, string> = {
  ADMIN: 'Admin',
  HR: 'HR',
  REVIEWER: 'Reviewer',
};

export const JOB_QUESTION_TYPE: Record<JobQuestionType, string> = {
  TEXT: 'Short text',
  TEXTAREA: 'Long text',
  NUMBER: 'Number',
  SELECT: 'Single choice',
  MULTISELECT: 'Multiple choice',
  BOOLEAN: 'Yes / no',
  YEARS: 'Years',
};

export const ASSESSMENT_QUESTION_TYPE: Record<QuestionType, string> = {
  MCQ: 'Multiple choice',
  TEXT: 'Written answer',
  CODING: 'Coding',
  SQL: 'SQL',
  DEBUGGING: 'Debugging',
  ARCHITECTURE: 'Architecture',
  SCENARIO: 'Scenario',
  FILE: 'File upload',
};

export const HARD_FAIL_ACTION: Record<HardFailAction, string> = {
  MANUAL_REVIEW: 'Flag for review',
  RECOMMEND_REJECT: 'Recommend reject',
};

export const COMM_STATUS: Record<CommStatus, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const EMAIL_TEMPLATE: Record<string, string> = {
  APPLICATION_RECEIVED: 'Application received',
  INITIAL_SHORTLIST: 'Shortlist notification',
  REJECTION: 'Rejection',
  ASSESSMENT_INVITE: 'Technical assessment invitation',
  ASSESSMENT_REMINDER: 'Assessment reminder',
  ASSESSMENT_EXPIRED: 'Assessment expired',
  TECHTEST_INVITE: 'Recorded technical interview invitation',
  INTERVIEW_INVITE: 'Interview invitation',
  INTERVIEWER_INVITE: 'Interviewer invitation',
  INTERVIEW_REMINDER: 'Interview reminder',
  OFFER: 'Job offer',
  HIRED: 'Hired confirmation',
};

export function emailTemplateLabel(templateKey: string): string {
  return EMAIL_TEMPLATE[templateKey] ?? templateKey.replaceAll('_', ' ').toLowerCase();
}

type TimelineEventInput = {
  event_type: string;
  actor_label?: string | null;
  payload?: unknown;
};

export function timelineEventTitle(event: TimelineEventInput): string {
  const payload =
    event.payload && typeof event.payload === 'object'
      ? (event.payload as Record<string, unknown>)
      : null;
  const decision = payload?.decision != null ? String(payload.decision) : null;
  const reason = payload?.reason != null ? String(payload.reason) : null;

  switch (event.event_type) {
    case 'APPLICATION_SUBMITTED':
      return 'Application submitted';
    case 'AI_SCREENING_COMPLETED':
      return 'AI screening completed';
    case 'AUTO_REJECTED':
      return reason ? `Automatically rejected — ${reason}` : 'Automatically rejected';
    case 'AUTO_SHORTLISTED':
      return reason ? `Automatically shortlisted — ${reason}` : 'Automatically shortlisted';
    case 'AUTO_ASSESSMENT_PASSED':
      return reason
        ? `Automatically advanced after assessment — ${reason}`
        : 'Automatically advanced after assessment';
    case 'HR_DECISION':
      if (decision === 'SHORTLIST') return 'HR shortlisted this candidate';
      if (decision === 'REJECT') return 'HR rejected this candidate';
      if (decision === 'HOLD') return 'HR placed this candidate on hold';
      if (decision === 'REQUEST_INFO') return 'HR requested more information';
      if (decision === 'ADDITIONAL_INTERVIEW') return 'HR requested an additional interview';
      if (decision === 'WITHDRAW') return 'HR marked this candidate as withdrawn';
      return 'HR decision recorded';
    case 'EMAIL_SEND_NOW':
      return 'Email send requested immediately';
    case 'ASSESSMENT_INVITED':
      return 'Assessment invitation sent';
    case 'ASSESSMENT_AUTO_SCHEDULED':
      return 'Assessment invitation scheduled';
    case 'ASSESSMENT_INVITE_SEND_NOW':
      return 'Assessment invitation sent immediately';
    case 'ASSESSMENT_INVITE_CANCELLED':
      return 'Assessment invitation cancelled';
    case 'TECHTEST_INVITED':
      return 'Recorded interview invitation sent';
    case 'TECHTEST_AUTO_SCHEDULED':
      return 'Recorded interview invitation scheduled';
    case 'TECHTEST_INVITE_SEND_NOW':
      return 'Recorded interview invitation sent immediately';
    case 'TECHTEST_INVITE_CANCELLED':
      return 'Recorded interview invitation cancelled';
    case 'AUTO_INVITE_SKIPPED':
      return 'Automatic invite skipped';
    case 'ASSESSMENT_EVALUATED':
      return 'Technical assessment graded';
    case 'TECHTEST_EVALUATED':
      return 'Recorded interview graded';
    default:
      return event.event_type.replaceAll('_', ' ').toLowerCase();
  }
}

export const PARSE_STATUS: Record<ParseStatus, string> = {
  PENDING: 'Pending',
  DONE: 'Done',
  MANUAL: 'Manual',
  FAILED: 'Failed',
};

export const ASSESSMENT_KIND: Record<AssessmentKind, string> = {
  ASSESSMENT: 'Assessment',
  TECH_TEST: 'Tech test',
};

export const SITTING_STATUS: Record<SittingStatus, string> = {
  INVITED: 'Invited',
  STARTED: 'Started',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const RECORDING_STATUS: Record<RecordingStatus, string> = {
  NOT_REQUIRED: 'Not required',
  UPLOAD_PENDING: 'Upload pending',
  READY: 'Ready',
  FAILED: 'Failed',
};

export const PROCTORING_SEVERITY: Record<ProctoringSeverity, string> = {
  INFO: 'Info',
  WARN: 'Warning',
  CRITICAL: 'Critical',
};

export const INTERVIEW_STATUS: Record<InterviewStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

export const ACTOR_TYPE: Record<ActorType, string> = {
  SYSTEM: 'System',
  HR: 'HR',
  CANDIDATE: 'Candidate',
  AI: 'AI',
  CRON: 'Cron',
};

export const HR_DECISION: Record<HrDecisionValue, string> = {
  SHORTLIST: 'Shortlist',
  REJECT: 'Reject',
  HOLD: 'Hold',
  REQUEST_INFO: 'Request info',
  ADDITIONAL_INTERVIEW: 'Additional interview',
  WITHDRAW: 'Withdraw',
};

/** Stages shown in the candidates list filter (not the full pipeline). */
export const CANDIDATE_LIST_STAGES = [
  'APPLICATION_RECEIVED',
  'CV_PROCESSING',
  'INITIAL_SCREENING',
  'INITIAL_SCREENING_REVIEW',
  'INITIAL_SHORTLISTED',
  'INITIAL_REJECTED',
  'TECH_ASSESSMENT_REVIEW',
  'RECORDED_TECH_REVIEW',
  'HIRED',
  'WITHDRAWN',
] as const satisfies readonly Stage[];

export const DECISIONS_BY_STAGE: Partial<Record<Stage, HrDecisionValue[]>> = {
  INITIAL_SCREENING_REVIEW: ['SHORTLIST', 'REJECT', 'HOLD', 'REQUEST_INFO', 'WITHDRAW'],
  TECH_ASSESSMENT_REVIEW: ['SHORTLIST', 'REJECT', 'HOLD', 'WITHDRAW'],
  RECORDED_TECH_REVIEW: ['SHORTLIST', 'REJECT', 'HOLD', 'ADDITIONAL_INTERVIEW', 'WITHDRAW'],
};

export const DEFAULT_HARD_FAIL: HardFailAction = 'MANUAL_REVIEW';

export const CANDIDATE_EMPLOYMENT_STATUS = {
  EMPLOYED: 'Employed',
  UNEMPLOYED: 'Unemployed',
  NOTICE_PERIOD: 'Serving notice',
  FREELANCE: 'Freelance',
  STUDENT: 'Student',
} as const satisfies Record<string, string>;

export function stageLabel(stage: Stage): string {
  return STAGE[stage];
}

export function labelOf<T extends string>(
  map: Record<T, string>,
  value: string | null | undefined,
  fallback = '—',
): string {
  if (value == null || value === '') return fallback;
  return (map as Record<string, string>)[value] ?? fallback;
}

export function selectOptions<T extends string>(
  map: Record<T, string>,
  values?: readonly T[],
): Array<{ value: T; label: string }> {
  const keys = values ?? (Object.keys(map) as T[]);
  return keys.map((value) => ({ value, label: map[value] }));
}
