import { ASSESSMENT_QUESTION_TYPE, HARD_FAIL_ACTION, JOB_QUESTION_TYPE, selectOptions } from '@/lib/labels';
import type {
  HardFailAction,
  HardRequirementOp,
  JobQuestionType,
  QuestionType,
} from '@/types/domain';

export type QuestionDraft = {
  draftId: string;
  /** Persisted key; empty until first save for new questions. */
  key: string;
  label: string;
  type: JobQuestionType;
  is_required: boolean;
  options: string[];
};

/** Question shapes remembered in localStorage for reuse on new HRSYSTEM_jobs. */
export type SavedQuestionTemplate = {
  id: string;
  label: string;
  type: JobQuestionType;
  is_required: boolean;
  options: string[];
  savedAt: string;
};

export type HardDraft = {
  fieldKey: string;
  op: HardRequirementOp;
  value: string;
  on_fail: HardFailAction;
};

export type SoftDraft = {
  fieldKey: string;
  weight: number;
};

export type JobEditorBasicsValues = {
  title: string;
  department: string;
  description: string;
  employment_type: string | null;
  location: string;
  work_mode: string | null;
  min_experience_years: number | string;
  required_skills: string[];
  preferred_skills: string[];
  salary_min: number | string;
  salary_max: number | string;
  currency: string;
  vacancies: number | string;
  application_deadline: string | null;
  shortlist_threshold: number | string;
  cv_required: boolean;
  ask_age: boolean;
  ask_military_status: boolean;
  ask_marital_status: boolean;
};

/** Which blocks of BasicsSection to render. Defaults to all. */
export type BasicsSectionParts = {
  role?: boolean;
  application?: boolean;
  advanced?: boolean;
};

export type DemographicRuleState = {
  ageMin: number | string;
  ageMax: number | string;
  ageOnFail: HardFailAction;
  militaryAccepted: string[];
  militaryOnFail: HardFailAction;
};

export const MILITARY_STATUS_OPTIONS = [
  'Completed',
  'Exempted',
  'Postponed',
  'Not applicable',
] as const;

export const HARD_OP_OPTIONS: Array<{ value: HardRequirementOp; label: string }> = [
  { value: '>=', label: 'At least' },
  { value: '<=', label: 'At most' },
  { value: '==', label: 'Equals' },
  { value: 'truthy', label: 'Is true' },
];

export const ON_FAIL_OPTIONS = selectOptions(HARD_FAIL_ACTION);

export const QUESTION_TYPE_OPTIONS = selectOptions(JOB_QUESTION_TYPE);

export type AssessmentQuestionDraft = {
  draftId: string;
  type: QuestionType;
  prompt: string;
  max_score: number | string;
  rubric: string;
  options: string[];
  correct_index: number | null;
  language: string | null;
};

export type AssessmentDraft = {
  title: string;
  instructions: string;
  duration_minutes: number | string;
  pass_score: number | string;
  questions: AssessmentQuestionDraft[];
  require_camera: boolean;
  require_mic: boolean;
  require_fullscreen: boolean;
  /** Plain text; one rule per line when shown to the candidate. */
  rules: string;
};

export const ASSESSMENT_QUESTION_TYPE_OPTIONS = selectOptions(ASSESSMENT_QUESTION_TYPE);

export const CODING_LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
];
