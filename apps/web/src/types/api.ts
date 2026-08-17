import type {
  Application,
  AssessmentKind,
  AssessmentQuestion,
  Candidate,
  Communication,
  Interview,
  Job,
  JobQuestion,
  JobQuestionType,
  JobStatus,
  ProctoringSeverity,
  Recommendation,
  RecordingStatus,
  RecruitmentEvent,
  SittingStatus,
  Stage,
  Status,
} from '@/types/domain';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DUPLICATE_APPLICATION'
  | 'JOB_CLOSED'
  | 'DEADLINE_PASSED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_USED'
  | 'ALREADY_SUBMITTED'
  | 'WRONG_STAGE'
  | 'RATE_LIMITED'
  | 'UPLOAD_INCOMPLETE'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  fields?: string[];
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody };

export interface AuthLoginPayload {
  email: string;
  password: string;
}

export interface AuthLoginResult {
  token: string;
  user: { id: string; full_name: string; email: string; role: string };
}

export interface AuthMeResult {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface PublicJobListItem {
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  application_deadline: string | null;
}

export interface PublicJobsListResult {
  jobs: PublicJobListItem[];
}

export interface PublicJobsGetPayload {
  slug: string;
}

export interface PublicJobDetail {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  description: string | null;
  employment_type: string | null;
  location: string | null;
  work_mode: string | null;
  required_skills: string[];
  preferred_skills: string[];
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  ask_age: boolean;
  ask_military_status: boolean;
  ask_marital_status: boolean;
  cv_required: boolean;
  application_deadline: string | null;
}

export interface PublicJobQuestion {
  id: string;
  key: string;
  label: string;
  type: JobQuestionType;
  options: unknown;
  is_required: boolean;
  order_index: number;
}

export interface PublicJobsGetResult {
  job: PublicJobDetail;
  questions: PublicJobQuestion[];
}

export interface CloudinarySignaturePayload {
  kind: 'cv' | 'video';
  job_slug?: string;
  token?: string;
}

export interface CloudinarySignatureResult {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: string;
  resource_type: string;
  public_id: string;
  max_bytes: number;
  allowed_formats: string[];
}

export interface ApplicationCandidateInput {
  full_name: string;
  email: string;
  phone: string;
  country?: string;
  city?: string;
  age?: number | null;
  military_status?: string | null;
  marital_status?: string | null;
}

export interface ApplicationProfessionalInput {
  employment_status?: string;
  current_company?: string;
  current_position?: string;
  years_experience?: number;
  expected_salary?: number;
  notice_period_days?: number;
  available_from?: string;
}

export interface ApplicationCvInput {
  public_id: string;
  resource_type: string;
  delivery_type: string;
  format: string;
  bytes: number;
  original_name: string;
}

export interface ApplicationSubmitPayload {
  idempotency_key: string;
  job_id: string;
  candidate: ApplicationCandidateInput;
  professional: ApplicationProfessionalInput;
  answers: Record<string, unknown>;
  cv?: ApplicationCvInput;
}

export interface ApplicationSubmitResult {
  application_id: string;
  candidate_id: string;
  stage: Stage;
}

export interface CandidateTokenPayload {
  token: string;
}

export interface CandidateQuestion {
  id: string;
  order_index: number;
  type: AssessmentQuestion['type'];
  prompt: string;
  options: unknown;
  language: string | null;
  max_score: number;
}

export interface CandidateAssessmentGetResult {
  candidate_name: string;
  job_title: string;
  assessment: {
    title: string;
    instructions: string | null;
    duration_minutes: number;
    question_count: number;
  };
  status: SittingStatus;
  invite_deadline: string;
  started_at: string | null;
  expires_at: string | null;
  server_time: string;
  questions: CandidateQuestion[];
  answers?: Array<{ question_id: string; answer: unknown }>;
  requirements?: {
    camera: boolean;
    mic: boolean;
    fullscreen: boolean;
    rules: string[];
  };
}

export interface CandidateAssessmentStartResult {
  started_at: string;
  expires_at: string;
  server_time: string;
  session_id?: string;
}

export interface CandidateAnswerInput {
  question_id: string;
  answer: unknown;
  time_spent_seconds?: number;
}

export interface CandidateAssessmentSavePayload {
  token: string;
  answers: CandidateAnswerInput[];
}

export interface CandidateAssessmentSaveResult {
  saved: number;
}

export interface CandidateAssessmentSubmitPayload {
  token: string;
  answers: CandidateAnswerInput[];
}

export interface CandidateAssessmentSubmitResult {
  submitted_at: string;
  late: boolean;
}

export interface TechTestStartPayload {
  token: string;
  accepted_rules: boolean;
}

export interface ProctoringEventInput {
  event_id: string;
  event: string;
  severity: ProctoringSeverity;
  occurred_at: string;
  metadata?: unknown;
}

export interface TechTestEventPayload {
  token: string;
  events: ProctoringEventInput[];
}

export interface TechTestEventResult {
  accepted: number;
  duplicates: number;
}

export interface RecordingInput {
  public_id: string;
  format: string;
  duration_seconds: number;
  bytes: number;
  started_at: string;
  ended_at: string;
  part_no: number;
}

export interface TechTestSubmitPayload {
  token: string;
  answers: CandidateAnswerInput[];
  recording?: RecordingInput;
  events?: ProctoringEventInput[];
}

export interface TechTestSubmitResult {
  submitted_at: string;
  recording_status: string;
}

export interface TechTestRecordingPayload {
  token: string;
  recording: RecordingInput;
}

export interface TechTestRecordingResult {
  recording_status: string;
}

export interface HrDashboardPayload {
  job_id: string | null;
}

export interface HrDashboardTotals {
  applicants: number;
  new_today: number;
  awaiting_review: number;
  assessments_pending: number;
  assessments_completed: number;
  techtests_pending: number;
  interviews_upcoming: number;
  hired: number;
  rejected: number;
  failed_emails: number;
  open_errors: number;
}

export interface HrDashboardResult {
  totals: HrDashboardTotals;
  by_job: Array<{
    job_id: string;
    title: string;
    counts: Record<string, number>;
  }>;
}

export interface HrCandidatesListPayload {
  job_id: string | null;
  stage: Stage | null;
  status: Status | null;
  q: string | null;
  min_score: number | null;
  max_score: number | null;
  min_experience: number | null;
  skills: string[] | null;
  applied_from: string | null;
  applied_to: string | null;
  assigned_hr_id: string | null;
  sort: string;
  page: number;
  page_size: number;
}

export interface HrCandidateListRow {
  application_id: string;
  candidate_id: string;
  full_name: string;
  email: string;
  job_title: string;
  stage: Stage;
  status: Status;
  screening_score: number | null;
  recommendation: Recommendation | null;
  assessment_score: number | null;
  techtest_score: number | null;
  years_experience: number | null;
  created_at: string;
}

export interface HrCandidatesListResult {
  total: number;
  page: number;
  page_size: number;
  rows: HrCandidateListRow[];
}

export interface HrCandidatesGetPayload {
  application_id: string;
}

export interface HrCandidatesGetResult {
  candidate: Candidate;
  application: Application;
  job: Job;
  answers: Array<{ question_key: string; label: string; answer: unknown }>;
  cv: {
    signed_url: string;
    expires_in: number;
    parse_status: string;
    parsed: unknown;
    original_name: string;
  } | null;
  screening: {
    score: number | null;
    recommendation: Recommendation | null;
    confidence: number | null;
    strengths: unknown;
    weaknesses: unknown;
    missing_requirements: unknown;
    reasoning_summary: string | null;
    hr_decision: string | null;
  } | null;
  assessment: {
    id: string;
    status: SittingStatus;
    invite_deadline: string;
    duration_minutes: number;
    started_at: string | null;
    expires_at: string | null;
    submitted_at: string | null;
    late: boolean;
    ai_score: number | null;
    ai_max_score: number | null;
    review: {
      overall_feedback: string | null;
      questions: Array<{
        id: string;
        order_index: number;
        type: AssessmentQuestion['type'];
        prompt: string;
        options: unknown;
        language: string | null;
        max_score: number;
        answer: unknown;
        evaluation: {
          score: number | null;
          max_score: number | null;
          correct_concepts: unknown;
          missing_concepts: unknown;
          technical_errors: unknown;
          feedback: string | null;
          confidence: number | null;
        } | null;
      }>;
    } | null;
  } | null;
  techtest: {
    id: string;
    status: SittingStatus;
    invite_deadline: string;
    duration_minutes: number;
    started_at: string | null;
    expires_at: string | null;
    submitted_at: string | null;
    late: boolean;
    ai_score: number | null;
    ai_max_score: number | null;
    recording_status: RecordingStatus | null;
    review: {
      overall_feedback: string | null;
      proctoring_flag: 'CLEAN' | 'MINOR_FLAGS' | 'REVIEW_RECORDING' | null;
      proctoring_summary: string | null;
      recording: {
        public_id: string;
        format: string | null;
        duration_seconds: number | null;
        started_at: string | null;
        ended_at: string | null;
        signed_url: string | null;
      } | null;
      events: Array<{
        id: string;
        event: string;
        severity: import('@/types/domain').ProctoringSeverity;
        occurred_at: string;
        metadata: unknown;
      }>;
      questions: Array<{
        id: string;
        order_index: number;
        type: AssessmentQuestion['type'];
        prompt: string;
        options: unknown;
        language: string | null;
        max_score: number;
        answer: unknown;
        evaluation: {
          score: number | null;
          max_score: number | null;
          correct_concepts: unknown;
          missing_concepts: unknown;
          technical_errors: unknown;
          feedback: string | null;
          confidence: number | null;
        } | null;
      }>;
    } | null;
  } | null;
  interviews: Interview[];
  communications: Communication[];
  timeline: RecruitmentEvent[];
  job_has_assessment: boolean;
  job_has_techtest: boolean;
}

export type HrDecisionValue =
  | 'SHORTLIST'
  | 'REJECT'
  | 'HOLD'
  | 'REQUEST_INFO'
  | 'ADDITIONAL_INTERVIEW'
  | 'WITHDRAW';

export interface HrDecisionPayload {
  application_id: string;
  decision: HrDecisionValue;
  note?: string | null;
  reason?: string | null;
  expected_stage: Stage;
}

export interface HrDecisionResult {
  stage: Stage;
  status: Status;
}

export interface HrInvitePayload {
  application_id: string;
  duration_minutes?: number;
  invite_hours?: number;
}

export interface HrInviteResult {
  candidate_assessment_id: string;
  invite_deadline: string;
  link: string;
}

export interface HrSettingsResult {
  auto_send_assessment: boolean;
  auto_send_assessment_delay_minutes: number;
  auto_send_techtest: boolean;
  auto_send_techtest_delay_minutes: number;
  updated_at: string;
}

export interface HrSettingsPatchPayload {
  auto_send_assessment?: boolean;
  auto_send_assessment_delay_minutes?: number;
  auto_send_techtest?: boolean;
  auto_send_techtest_delay_minutes?: number;
}

export interface HrInterviewSchedulePayload {
  application_id: string;
  round_no: number;
  scheduled_at: string;
  timezone: string;
  duration_minutes: number;
  interviewer_name?: string;
  interviewer_email?: string;
  meeting_url?: string;
}

export interface HrInterviewScheduleResult {
  interview_id: string;
  stage: Stage;
}

export interface HrInterviewCompletePayload {
  interview_id: string;
  score?: number;
  notes?: string;
  salary_discussed?: number;
  availability_note?: string;
  recommendation?: string;
}

export interface HrInterviewCompleteResult {
  stage: Stage;
}

export type HrFinalDecisionValue =
  | 'HIRED'
  | 'FINAL_REJECTED'
  | 'HOLD'
  | 'SECOND_FINAL_INTERVIEW'
  | 'OFFER_PENDING';

export interface HrFinalDecisionPayload {
  application_id: string;
  decision: HrFinalDecisionValue;
  note?: string;
}

export interface HrFinalDecisionResult {
  stage: Stage;
  status: Status;
}

export interface HrInterviewsListResult {
  upcoming: Array<
    Interview & {
      candidate_name: string;
      candidate_email: string;
      job_title: string;
      application_stage: Stage;
    }
  >;
  awaiting: Array<{
    application_id: string;
    candidate_name: string;
    candidate_email: string;
    job_title: string;
    stage: Stage;
    updated_at: string;
  }>;
}

export interface HrJobsListPayload {
  status: JobStatus | null;
}

export interface HrJobsListResult {
  jobs: Array<
    Job & {
      assessment_question_count: number | null;
      assessment_duration_minutes: number | null;
    }
  >;
}

export interface HrJobsGetPayload {
  job_id: string;
}

export interface HrJobAssessmentDetail {
  id: string;
  kind: AssessmentKind;
  title: string;
  instructions: string | null;
  duration_minutes: number;
  pass_score: number;
  require_camera: boolean;
  require_mic: boolean;
  require_fullscreen: boolean;
  rules: string | null;
  is_active: boolean;
  questions: AssessmentQuestion[];
}

export interface HrJobsGetResult {
  job: Job;
  questions: JobQuestion[];
  assessments: HrJobAssessmentDetail[];
}

export interface HrJobsCreateResult {
  job_id: string;
  slug: string;
}

export interface HrJobsUpdatePayload {
  job_id: string;
  [key: string]: unknown;
}

export interface HrJobsUpdateResult {
  job_id: string;
}

export interface HrJobsQuestionsSetPayload {
  job_id: string;
  questions: Array<Omit<JobQuestion, 'id' | 'job_id'> & { id?: string }>;
}

export interface HrJobsQuestionsSetResult {
  count: number;
}

export interface HrJobsAssessmentSetPayload {
  job_id: string;
  kind: AssessmentKind;
  title: string;
  instructions?: string | null;
  duration_minutes: number;
  pass_score: number;
  require_camera?: boolean;
  require_mic?: boolean;
  require_fullscreen?: boolean;
  rules?: string | null;
  questions: Array<{
    type: AssessmentQuestion['type'];
    prompt: string;
    options?: unknown;
    correct_key?: string;
    language?: string | null;
    max_score: number;
    rubric?: string;
  }>;
}

export interface HrJobsAssessmentSetResult {
  assessment_id: string;
  question_count: number;
}

export interface HrErrorsListPayload {
  resolved: boolean;
  limit: number;
}

export interface HrErrorsListResult {
  errors: Array<{
    id: number;
    action: string | null;
    node: string | null;
    error_message: string | null;
    created_at: string;
    resolved: boolean;
  }>;
  failed_emails: Array<{
    id: string;
    template_key: string;
    to_email: string;
    subject: string | null;
    last_error: string | null;
    attempts: number;
    application_id: string | null;
    created_at: string;
  }>;
}

export interface HrEmailRetryPayload {
  communication_id: string;
}

export interface HrEmailRetryResult {
  status: string;
}

export interface EmailDispatchResult {
  claimed: number;
  sent: number;
  failed: number;
}

export type RpcEnvelope = {
  action: string;
  payload: unknown;
  idempotency_key?: string;
};

export type AutomationTask = 'cv.parse' | 'screening.run' | 'assessment.grade' | 'email.send';

export interface AutomationError {
  code: string;
  message: string;
}

export type AutomationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AutomationError };

export interface CvParsePayload {
  cv_url: string;
}

export interface CvParseData {
  parsed: {
    full_name?: string;
    years_experience?: number;
    skills: string[];
    technologies: string[];
    work_experience: unknown[];
    education: unknown[];
    languages: Record<string, unknown>;
    certifications: unknown[];
    projects: unknown[];
  };
  raw_text: string;
}

export interface ScreeningRunPayload {
  job: unknown;
  candidate_answers: unknown;
  cv_parsed: unknown;
  hard_requirement_failures: unknown[];
}

export interface ScreeningRunData {
  score: number;
  decision: string;
  confidence: number;
  strengths: unknown[];
  weaknesses: unknown[];
  missing_requirements: unknown[];
  evidence: unknown[];
  reasoning_summary: string;
}

export interface AssessmentGradeQuestion {
  question_id: string;
  type: string;
  prompt: string;
  rubric: string | null;
  max_score: number;
  answer: unknown;
}

export interface AssessmentGradePayload {
  questions: AssessmentGradeQuestion[];
}

export interface AssessmentGradeResultItem {
  question_id: string;
  score: number;
  max_score: number;
  correct_concepts: unknown[];
  missing_concepts: unknown[];
  technical_errors: unknown[];
  feedback: string;
  confidence: number;
}

export interface AssessmentGradeData {
  results: AssessmentGradeResultItem[];
}

export interface EmailSendPayload {
  to: string;
  subject: string;
  html: string;
  from_name?: string;
}

export interface EmailSendData {
  message_id: string;
  thread_id?: string;
}
