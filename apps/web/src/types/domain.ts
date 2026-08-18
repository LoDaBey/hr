export type Stage =
  | 'APPLICATION_RECEIVED'
  | 'CV_PROCESSING'
  | 'INITIAL_SCREENING'
  | 'INITIAL_SCREENING_REVIEW'
  | 'INITIAL_SHORTLISTED'
  | 'INITIAL_REJECTED'
  | 'TECH_ASSESSMENT_SENT'
  | 'TECH_ASSESSMENT_STARTED'
  | 'TECH_ASSESSMENT_SUBMITTED'
  | 'TECH_ASSESSMENT_EXPIRED'
  | 'TECH_ASSESSMENT_REVIEW'
  | 'TECH_SHORTLISTED'
  | 'TECH_REJECTED'
  | 'RECORDED_TECH_INVITED'
  | 'RECORDED_TECH_STARTED'
  | 'RECORDED_TECH_SUBMITTED'
  | 'RECORDED_TECH_EXPIRED'
  | 'RECORDED_TECH_REVIEW'
  | 'RECORDED_TECH_SHORTLISTED'
  | 'RECORDED_TECH_REJECTED'
  | 'FINAL_INTERVIEW_PENDING'
  | 'FINAL_INTERVIEW_SCHEDULED'
  | 'FINAL_INTERVIEW_COMPLETED'
  | 'SECOND_FINAL_INTERVIEW'
  | 'OFFER_PENDING'
  | 'HIRED'
  | 'FINAL_REJECTED'
  | 'WITHDRAWN';

export type Status = 'ACTIVE' | 'ON_HOLD' | 'REJECTED' | 'HIRED' | 'WITHDRAWN';
export type Role = 'ADMIN' | 'HR' | 'REVIEWER';
export type Recommendation =
  | 'STRONG_SHORTLIST'
  | 'SHORTLIST'
  | 'MANUAL_REVIEW'
  | 'RECOMMEND_REJECT';
export type AssessmentKind = 'ASSESSMENT' | 'TECH_TEST';
export type QuestionType =
  | 'MCQ'
  | 'TEXT'
  | 'CODING'
  | 'SQL'
  | 'DEBUGGING'
  | 'ARCHITECTURE'
  | 'SCENARIO'
  | 'FILE';

export type JobStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED';
export type JobDepartment =
  | 'Social Media'
  | 'Data Analysis & Monitoring'
  | 'Human Resources'
  | 'Digital Engagement'
  | 'Web Development'
  | 'QC'
  | 'Productions';
export type JobCurrency = 'EGP' | 'USD' | 'AED';
export type JobQuestionType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'SELECT'
  | 'MULTISELECT'
  | 'BOOLEAN'
  | 'YEARS';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE';
export type ParseStatus = 'PENDING' | 'DONE' | 'MANUAL' | 'FAILED';
export type SittingStatus = 'INVITED' | 'STARTED' | 'SUBMITTED' | 'EXPIRED' | 'CANCELLED';
export type RecordingStatus = 'NOT_REQUIRED' | 'UPLOAD_PENDING' | 'READY' | 'FAILED';
export type ProctoringSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type CommStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type ActorType = 'SYSTEM' | 'HR' | 'CANDIDATE' | 'AI' | 'CRON';
export type TokenPurpose = 'ASSESSMENT' | 'TECH_TEST';

export type HardRequirementOp = '>=' | '<=' | '==' | 'truthy';
export type HardFailAction = 'RECOMMEND_REJECT' | 'MANUAL_REVIEW';

export interface HardRequirement {
  key: string;
  label: string;
  op: HardRequirementOp;
  value: unknown;
  on_fail: HardFailAction;
}

export interface HardRequirementFailure {
  key: string;
  label: string;
  required: unknown;
  got: unknown;
  on_fail: HardFailAction;
}

export interface Document {
  id: string;
  candidate_id: string;
  application_id: string | null;
  doc_type: string;
  public_id: string;
  resource_type: string;
  delivery_type: string;
  format: string | null;
  bytes: number | null;
  original_name: string | null;
  raw_text: string | null;
  parsed: unknown;
  parse_status: ParseStatus;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewRecruitmentEvent {
  application_id?: string | null;
  candidate_id?: string | null;
  job_id?: string | null;
  event_type: string;
  from_stage?: Stage | null;
  to_stage?: Stage | null;
  actor_type: ActorType;
  actor_id?: string | null;
  actor_label?: string | null;
  payload?: unknown;
}

export interface NewCommunication {
  candidate_id?: string | null;
  application_id?: string | null;
  template_key: string;
  to_email: string;
  subject?: string | null;
  variables?: unknown;
  dedupe_key: string;
  scheduled_for?: string | null;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  description: string | null;
  employment_type: string | null;
  location: string | null;
  work_mode: string | null;
  min_experience_years: number | null;
  required_skills: string[];
  preferred_skills: string[];
  education_requirement: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  languages: unknown;
  notice_period_max_days: number | null;
  ask_age: boolean;
  ask_military_status: boolean;
  ask_marital_status: boolean;
  hard_requirements: HardRequirement[];
  soft_requirements: unknown;
  screening_weights: unknown;
  shortlist_threshold: number;
  cv_required: boolean;
  allow_reapply_days: number;
  assessment_invite_hours: number;
  techtest_invite_hours: number;
  application_deadline: string | null;
  vacancies: number;
  hiring_manager: string | null;
  assigned_hr_id: string | null;
  status: JobStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobQuestion {
  id: string;
  job_id: string;
  order_index: number;
  label: string;
  key: string;
  type: JobQuestionType;
  options: unknown;
  is_required: boolean;
}

export interface Candidate {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  country: string | null;
  city: string | null;
  age: number | null;
  military_status: string | null;
  marital_status: string | null;
  phone_history: unknown;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  stage: Stage;
  status: Status;
  employment_status: string | null;
  current_company: string | null;
  current_position: string | null;
  years_experience: number | null;
  expected_salary: number | null;
  notice_period_days: number | null;
  available_from: string | null;
  screening_score: number | null;
  assessment_score: number | null;
  techtest_score: number | null;
  final_score: number | null;
  hold_reason: string | null;
  reject_reason: string | null;
  source: string | null;
  submission_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreeningResult {
  id: string;
  application_id: string;
  score: number | null;
  recommendation: Recommendation | null;
  confidence: number | null;
  strengths: unknown;
  weaknesses: unknown;
  missing_requirements: unknown;
  hard_fail: boolean;
  reasoning_summary: string | null;
  model: string | null;
  raw_response: unknown;
  hr_decision: string | null;
  hr_override_reason: string | null;
  hr_user_id: string | null;
  hr_decided_at: string | null;
  created_at: string;
}

export interface CandidateAssessment {
  id: string;
  application_id: string;
  assessment_id: string;
  kind: AssessmentKind;
  status: SittingStatus;
  invite_deadline: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  late: boolean;
  attempts_allowed: number;
  attempt_no: number;
  ai_score: number | null;
  ai_max_score: number | null;
  hr_decision: string | null;
  hr_user_id: string | null;
  hr_decided_at: string | null;
  recording_status: RecordingStatus | null;
  violations_count: number;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  order_index: number;
  type: QuestionType;
  prompt: string;
  options: unknown;
  correct_key: string | null;
  language: string | null;
  max_score: number;
  rubric: string | null;
}

export interface Evaluation {
  id: string;
  candidate_assessment_id: string;
  question_id: string | null;
  is_overall: boolean;
  score: number | null;
  max_score: number | null;
  correct_concepts: unknown;
  missing_concepts: unknown;
  technical_errors: unknown;
  feedback: string | null;
  confidence: number | null;
  model: string | null;
  raw_response: unknown;
  created_at: string;
}

export interface Interview {
  id: string;
  application_id: string;
  round_no: number;
  scheduled_at: string;
  timezone: string;
  duration_minutes: number;
  interviewer_name: string | null;
  interviewer_email: string | null;
  meeting_url: string | null;
  status: InterviewStatus;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  score: number | null;
  notes: string | null;
  salary_discussed: number | null;
  availability_note: string | null;
  recommendation: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  candidate_id: string | null;
  application_id: string | null;
  template_key: string;
  to_email: string;
  subject: string | null;
  variables: unknown;
  status: CommStatus;
  attempts: number;
  last_error: string | null;
  gmail_message_id: string | null;
  dedupe_key: string;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
}

export interface RecruitmentEvent {
  id: number;
  application_id: string | null;
  candidate_id: string | null;
  job_id: string | null;
  event_type: string;
  from_stage: Stage | null;
  to_stage: Stage | null;
  actor_type: ActorType;
  actor_id: string | null;
  actor_label: string | null;
  payload: unknown;
  created_at: string;
}

export interface ProctoringEvent {
  id: string;
  candidate_assessment_id: string;
  event: string;
  severity: ProctoringSeverity;
  occurred_at: string;
  metadata: unknown;
  event_id: string | null;
  created_at: string;
}

export interface EmailTemplate {
  key: string;
  subject: string;
  body_html: string;
  language: string;
  updated_at: string;
}

export interface WorkflowError {
  id: number;
  action: string | null;
  node: string | null;
  error_message: string | null;
  error_stack: string | null;
  application_id: string | null;
  candidate_id: string | null;
  input_ref: unknown;
  retry_count: number;
  resolved: boolean;
  created_at: string;
}

export interface AppSettings {
  id: boolean;
  auto_send_assessment: boolean;
  auto_send_assessment_delay_minutes: number;
  auto_send_techtest: boolean;
  auto_send_techtest_delay_minutes: number;
  updated_at: string;
  updated_by: string | null;
}
