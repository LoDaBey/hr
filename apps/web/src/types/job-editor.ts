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

/** Question shapes remembered in localStorage for reuse on new jobs. */
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

export type ScreeningWeights = {
  skills: number;
  experience: number;
  answers: number;
  education: number;
};

export const DEFAULT_SCREENING_WEIGHTS: ScreeningWeights = {
  skills: 40,
  experience: 30,
  answers: 20,
  education: 10,
};

export function parseScreeningWeights(value: unknown): ScreeningWeights {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  function num(key: keyof ScreeningWeights): number {
    const n = Number(record[key]);
    return Number.isFinite(n) ? n : DEFAULT_SCREENING_WEIGHTS[key];
  }
  return {
    skills: num('skills'),
    experience: num('experience'),
    answers: num('answers'),
    education: num('education'),
  };
}

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
  shortlist_threshold: number | string | null;
  screening_criteria: string;
  screening_weights: ScreeningWeights;
  cv_required: boolean;
  ask_age: boolean;
  ask_military_status: boolean;
  ask_marital_status: boolean;
};

/** Which blocks of BasicsSection to render. Defaults to all. */
export type BasicsSectionParts = {
  role?: boolean;
  application?: boolean;
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

export const MARITAL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Divorced',
  'Widowed',
] as const;

export const HARD_OP_OPTIONS: Array<{ value: HardRequirementOp; label: string }> = [
  { value: '>=', label: 'At least' },
  { value: '<=', label: 'At most' },
  { value: '==', label: 'Equals' },
  { value: 'in', label: 'One of' },
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
  require_screen_share: boolean;
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
