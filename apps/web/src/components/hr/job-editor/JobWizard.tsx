'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Group,
  Stack,
  Stepper,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { AnimatePresence, motion } from 'framer-motion';
import { MotionButton } from '@/components/MotionButton';
import { ApiError, api } from '@/lib/api';
import { DEFAULT_HARD_FAIL, normalizeJobCurrency } from '@/lib/labels';
import { motionTransitionFast } from '@/lib/motion';
import { rememberQuestions } from '@/lib/question-library';
import { toastError, toastSuccess } from '@/lib/toast';
import { assignQuestionKeys } from '@/lib/question-key';
import { publicJobUrl } from '@/lib/public-job-url';
import { density } from '@/theme';
import type {
  HrJobsAssessmentSetResult,
  HrJobsCreateResult,
  HrJobsGetResult,
  HrJobsQuestionsSetResult,
  HrJobsUpdateResult,
} from '@/types/api';
import type { HardRequirement, JobQuestion, JobStatus } from '@/types/domain';
import type {
  AssessmentDraft,
  DemographicRuleState,
  HardDraft,
  JobEditorBasicsValues,
  QuestionDraft,
  SoftDraft,
} from '@/types/job-editor';
import {
  AssessmentSection,
  assessmentDraftFromDetail,
  createEmptyAssessmentDraft,
  serializeAssessmentQuestions,
} from './AssessmentSection';
import { BasicsSection } from './BasicsSection';
import { EditorSection } from './EditorSection';
import { JobStatusBadge } from './JobStatusBadge';
import { JobWizardReview } from './JobWizardReview';
import { QuestionsSection } from './QuestionsSection';
import { ScreeningRulesSection } from './ScreeningRulesSection';
import { ShareLinkPanel } from './ShareLinkPanel';

const YEARS_EXPERIENCE_FIELD = {
  value: 'years_experience',
  label: 'Years of experience',
} as const;

const STEPS = [
  {
    label: 'Role',
    description: 'The basics candidates see on the application page.',
  },
  {
    label: 'Application form',
    description: 'What every applicant fills in. These answers feed screening.',
  },
  {
    label: 'Screening rules',
    description: 'How applicants are scored automatically. You always make the final call.',
  },
  {
    label: 'Assessments',
    description: "Optional. Sent after you shortlist someone. Skip if you don't need them.",
  },
  {
    label: 'Review',
    description: 'Check it over, then publish to get your shareable link.',
  },
] as const;

function draftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function questionsFromJob(questions: JobQuestion[]): QuestionDraft[] {
  return questions.map((q) => ({
    draftId: draftId(),
    key: q.key,
    label: q.label,
    type: q.type,
    is_required: q.is_required,
    options: Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [],
  }));
}

function extractDemographicAndHard(value: unknown): {
  demographic: DemographicRuleState;
  hardRows: HardDraft[];
} {
  const demographic: DemographicRuleState = {
    ageMin: '',
    ageMax: '',
    ageOnFail: DEFAULT_HARD_FAIL,
    militaryAccepted: [],
    militaryOnFail: DEFAULT_HARD_FAIL,
  };
  const hardRows: HardDraft[] = [];

  if (!Array.isArray(value)) {
    return { demographic, hardRows };
  }

  for (const item of value) {
    const row = item as HardRequirement;
    if (row.key === 'age') {
      if (row.op === '>=') {
        demographic.ageMin = row.value == null || row.value === '' ? '' : Number(row.value);
        demographic.ageOnFail = row.on_fail ?? DEFAULT_HARD_FAIL;
      } else if (row.op === '<=') {
        demographic.ageMax = row.value == null || row.value === '' ? '' : Number(row.value);
        demographic.ageOnFail = row.on_fail ?? DEFAULT_HARD_FAIL;
      }
      continue;
    }
    if (row.key === 'military_status') {
      demographic.militaryAccepted = Array.isArray(row.value)
        ? row.value.map(String)
        : row.value == null || row.value === ''
          ? []
          : [String(row.value)];
      demographic.militaryOnFail = row.on_fail ?? DEFAULT_HARD_FAIL;
      continue;
    }
    hardRows.push({
      fieldKey: row.key ?? '',
      op: row.op ?? '>=',
      value: row.value == null ? '' : String(row.value),
      on_fail: row.on_fail ?? DEFAULT_HARD_FAIL,
    });
  }

  return { demographic, hardRows };
}

function softFromJob(value: unknown): SoftDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as { key?: string; weight?: number };
    return {
      fieldKey: row.key ?? 'years_experience',
      weight: Number(row.weight) || 5,
    };
  });
}

function fieldLabel(
  fieldKey: string,
  questions: Array<{ key: string; draftId: string; label: string }>,
): string {
  if (fieldKey === YEARS_EXPERIENCE_FIELD.value) return YEARS_EXPERIENCE_FIELD.label;
  const q = questions.find(
    (row) => row.key === fieldKey || `draft:${row.draftId}` === fieldKey,
  );
  return q?.label?.trim() || fieldKey;
}

function resolveFieldKey(
  fieldKey: string,
  questions: Array<{ key: string; draftId: string }>,
): string {
  if (fieldKey === YEARS_EXPERIENCE_FIELD.value) return YEARS_EXPERIENCE_FIELD.value;
  if (fieldKey.startsWith('draft:')) {
    const draftIdValue = fieldKey.slice('draft:'.length);
    const q = questions.find((row) => row.draftId === draftIdValue);
    return q?.key || fieldKey;
  }
  return fieldKey;
}

function buildDemographicHard(
  askAge: boolean,
  askMilitary: boolean,
  demographic: DemographicRuleState,
): HardRequirement[] {
  const out: HardRequirement[] = [];
  if (askAge) {
    const min = demographic.ageMin === '' || demographic.ageMin == null ? null : Number(demographic.ageMin);
    const max = demographic.ageMax === '' || demographic.ageMax == null ? null : Number(demographic.ageMax);
    if (min != null && !Number.isNaN(min)) {
      out.push({
        key: 'age',
        label: 'Minimum age',
        op: '>=',
        value: min,
        on_fail: demographic.ageOnFail,
      });
    }
    if (max != null && !Number.isNaN(max)) {
      out.push({
        key: 'age',
        label: 'Maximum age',
        op: '<=',
        value: max,
        on_fail: demographic.ageOnFail,
      });
    }
  }
  if (askMilitary && demographic.militaryAccepted.length > 0) {
    out.push({
      key: 'military_status',
      label: 'Military status',
      op: '==',
      value: demographic.militaryAccepted,
      on_fail: demographic.militaryOnFail,
    });
  }
  return out;
}

function optionalNumber(value: number | string): number | null {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function JobWizard({
  mode,
  initial,
  initialStep = 0,
  onDraftProgress,
  onSaved,
  onPublished,
}: {
  mode: 'create' | 'edit';
  initial?: HrJobsGetResult | null;
  /** 0-based step for create resume after refresh. */
  initialStep?: number;
  /** Called after each create-mode persist so the URL can keep jobId + step. */
  onDraftProgress?: (jobId: string, step: number) => void;
  onSaved: (jobId: string) => void;
  /** After publish — stay on review with the share link; do not navigate away. */
  onPublished?: (jobId: string) => void;
}) {
  const guided = mode === 'create';
  const job = initial?.job;
  const initialParsed = extractDemographicAndHard(job?.hard_requirements);

  const [active, setActive] = useState(() =>
    Math.min(STEPS.length - 1, Math.max(0, initialStep)),
  );
  const [furthest, setFurthest] = useState(() =>
    guided ? Math.min(STEPS.length - 1, Math.max(0, initialStep)) : STEPS.length - 1,
  );
  const [jobId, setJobId] = useState<string | null>(job?.id ?? null);
  const [jobSlug, setJobSlug] = useState<string | null>(job?.slug ?? null);
  const [jobStatus, setJobStatus] = useState(job?.status ?? null);

  const [hardRows, setHardRows] = useState<HardDraft[]>(() => initialParsed.hardRows);
  const [softRows, setSoftRows] = useState<SoftDraft[]>(() => softFromJob(job?.soft_requirements));
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    questionsFromJob(initial?.questions ?? []),
  );
  const [assessment, setAssessment] = useState<AssessmentDraft>(() => {
    const activePaper = initial?.assessments?.find((a) => a.kind === 'ASSESSMENT' && a.is_active);
    return activePaper
      ? assessmentDraftFromDetail(activePaper)
      : createEmptyAssessmentDraft('ASSESSMENT');
  });
  const [techTest, setTechTest] = useState<AssessmentDraft>(() => {
    const activePaper = initial?.assessments?.find((a) => a.kind === 'TECH_TEST' && a.is_active);
    return activePaper
      ? assessmentDraftFromDetail(activePaper)
      : createEmptyAssessmentDraft('TECH_TEST');
  });
  const [demographic, setDemographic] = useState<DemographicRuleState>(() => initialParsed.demographic);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [stepDirection, setStepDirection] = useState(1);

  const form = useForm<JobEditorBasicsValues>({
    initialValues: {
      title: job?.title ?? '',
      department: job?.department ?? '',
      description: job?.description ?? '',
      employment_type: job?.employment_type ?? null,
      location: job?.location ?? '',
      work_mode: job?.work_mode ?? null,
      min_experience_years: job?.min_experience_years ?? 0,
      required_skills: job?.required_skills ?? [],
      preferred_skills: job?.preferred_skills ?? [],
      salary_min: job?.salary_min ?? '',
      salary_max: job?.salary_max ?? '',
      currency: normalizeJobCurrency(job?.currency),
      vacancies: job?.vacancies ?? 1,
      application_deadline: job?.application_deadline ?? null,
      shortlist_threshold: job?.shortlist_threshold ?? 70,
      cv_required: job?.cv_required ?? true,
      ask_age: job?.ask_age ?? false,
      ask_military_status: job?.ask_military_status ?? false,
      ask_marital_status: job?.ask_marital_status ?? false,
    },
  });

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const publicUrl = useMemo(() => {
    if (!jobSlug || jobStatus !== 'OPEN') return null;
    return publicJobUrl(jobSlug);
  }, [jobSlug, jobStatus]);

  const fieldOptions = useMemo(() => {
    const questionOptions = questions.map((q) => ({
      value: q.key || `draft:${q.draftId}`,
      label: q.label.trim() || 'Untitled question',
    }));
    return [YEARS_EXPERIENCE_FIELD, ...questionOptions];
  }, [questions]);

  const questionsReady = questions.some((q) => q.label.trim() !== '');
  const step1Valid = form.values.title.trim() !== '';
  const requiredFieldsComplete = step1Valid;
  const step2Valid = questionsReady;

  function markDirty() {
    setDirty(true);
    setFormError(null);
  }

  function prepareQuestionsWithKeys(): QuestionDraft[] {
    const keys = assignQuestionKeys(questions);
    return questions.map((q, index) => ({ ...q, key: keys[index]! }));
  }

  function buildHard(questionsWithKeys: QuestionDraft[]): HardRequirement[] {
    const fromRows: HardRequirement[] = hardRows
      .filter((row) => row.fieldKey)
      .map((row) => {
        const key = resolveFieldKey(row.fieldKey, questionsWithKeys);
        let value: unknown = row.value;
        if (row.op === 'truthy') value = true;
        else if (row.value !== '' && !Number.isNaN(Number(row.value))) value = Number(row.value);
        return {
          key,
          label: fieldLabel(row.fieldKey, questionsWithKeys),
          op: row.op,
          value,
          on_fail: row.on_fail,
        };
      });

    return [
      ...fromRows,
      ...buildDemographicHard(
        form.values.ask_age,
        form.values.ask_military_status,
        demographic,
      ),
    ];
  }

  function buildSoft(questionsWithKeys: QuestionDraft[]) {
    return softRows
      .filter((row) => row.fieldKey)
      .map((row) => {
        const key = resolveFieldKey(row.fieldKey, questionsWithKeys);
        return {
          key,
          label: fieldLabel(row.fieldKey, questionsWithKeys),
          weight: Math.min(20, Math.max(1, Number(row.weight) || 5)),
        };
      });
  }

  async function saveBasicsAndRequirements(
    currentJobId: string | null,
    questionsWithKeys: QuestionDraft[],
  ): Promise<{ id: string; slug: string; status: string }> {
    const values = form.values;
    const payload = {
      title: values.title.trim(),
      department: values.department || null,
      description: values.description || null,
      employment_type: values.employment_type,
      location: values.location || null,
      work_mode: values.work_mode,
      min_experience_years: Number(values.min_experience_years) || 0,
      required_skills: values.required_skills,
      preferred_skills: values.preferred_skills,
      salary_min: optionalNumber(values.salary_min),
      salary_max: optionalNumber(values.salary_max),
      currency: values.currency || null,
      vacancies: Math.max(1, Number(values.vacancies) || 1),
      application_deadline: values.application_deadline,
      shortlist_threshold: Number(values.shortlist_threshold) || 70,
      cv_required: values.cv_required,
      ask_age: values.ask_age,
      ask_military_status: values.ask_military_status,
      ask_marital_status: values.ask_marital_status,
      hard_requirements: buildHard(questionsWithKeys),
      soft_requirements: buildSoft(questionsWithKeys),
    };

    if (!currentJobId) {
      const created = await api<HrJobsCreateResult>('/api/hr/jobs', {
        method: 'POST',
        body: payload,
      });
      return { id: created.job_id, slug: created.slug, status: 'DRAFT' as const };
    }

    await api<HrJobsUpdateResult>(`/api/hr/jobs/${currentJobId}`, {
      method: 'PATCH',
      body: payload,
    });
    return {
      id: currentJobId,
      slug: jobSlug ?? '',
      status: (jobStatus ?? 'DRAFT') as 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED',
    };
  }

  async function saveQuestions(id: string, questionsWithKeys: QuestionDraft[]) {
    await api<HrJobsQuestionsSetResult>(`/api/hr/jobs/${id}/questions`, {
      method: 'PUT',
      body: {
        questions: questionsWithKeys.map((q, index) => ({
          order_index: index,
          key: q.key,
          label: q.label.trim(),
          type: q.type,
          is_required: q.is_required,
          options: q.options,
        })),
      },
    });
  }

  function assessmentReadyToSave(draft: AssessmentDraft): string | null {
    const hasAny =
      draft.title.trim() !== '' ||
      draft.instructions.trim() !== '' ||
      draft.questions.length > 0;
    if (!hasAny) return null;
    if (!draft.title.trim()) return 'Assessment title is required';
    if (draft.questions.length === 0) return 'Add at least one assessment question';
    for (const [index, q] of draft.questions.entries()) {
      if (!q.prompt.trim()) return `Assessment question ${index + 1} needs a prompt`;
      if (q.type === 'MCQ') {
        const filled = q.options.map((o) => o.trim()).filter(Boolean);
        if (filled.length < 2) return `Assessment question ${index + 1} needs at least two options`;
        if (q.correct_index == null || q.correct_index < 0 || q.correct_index >= q.options.length) {
          return `Assessment question ${index + 1} needs a correct answer`;
        }
        if (!q.options[q.correct_index]?.trim()) {
          return `Assessment question ${index + 1} correct answer cannot be empty`;
        }
      }
      if ((q.type === 'CODING' || q.type === 'SQL') && !q.language) {
        return `Assessment question ${index + 1} needs a language`;
      }
    }
    return 'ok';
  }

  async function saveAssessmentPaper(
    id: string,
    kind: 'ASSESSMENT' | 'TECH_TEST',
    draft: AssessmentDraft,
  ) {
    const state = assessmentReadyToSave(draft);
    if (state === null) return;
    if (state !== 'ok') {
      throw new ApiError('VALIDATION_FAILED', state, 400);
    }
    await api<HrJobsAssessmentSetResult>(`/api/hr/jobs/${id}/assessment`, {
      method: 'PUT',
      body: {
        kind,
        title: draft.title.trim(),
        instructions: draft.instructions.trim() || null,
        duration_minutes: Math.max(5, Number(draft.duration_minutes) || (kind === 'TECH_TEST' ? 20 : 45)),
        pass_score: Math.min(100, Math.max(0, Number(draft.pass_score) || 60)),
        require_camera: draft.require_camera,
        require_mic: draft.require_mic,
        require_fullscreen: draft.require_fullscreen,
        rules: draft.rules.trim() || null,
        questions: serializeAssessmentQuestions(draft.questions),
      },
    });
  }

  async function persistAll(): Promise<string> {
    const questionsWithKeys = prepareQuestionsWithKeys();
    const saved = await saveBasicsAndRequirements(jobId, questionsWithKeys);
    setJobId(saved.id);
    if (saved.slug) setJobSlug(saved.slug);
    if (saved.status) setJobStatus(saved.status as typeof jobStatus);

    if (questionsWithKeys.length > 0) {
      await saveQuestions(saved.id, questionsWithKeys);
    }
    await saveAssessmentPaper(saved.id, 'ASSESSMENT', assessment);
    await saveAssessmentPaper(saved.id, 'TECH_TEST', techTest);

    setQuestions(questionsWithKeys);
    rememberQuestions(questionsWithKeys);
    setHardRows((rows) =>
      rows.map((row) => ({
        ...row,
        fieldKey: resolveFieldKey(row.fieldKey, questionsWithKeys),
      })),
    );
    setSoftRows((rows) =>
      rows.map((row) => ({
        ...row,
        fieldKey: resolveFieldKey(row.fieldKey, questionsWithKeys),
      })),
    );
    setDirty(false);
    return saved.id;
  }

  function goToStep(next: number) {
    setStepDirection(next > active ? 1 : -1);
    setActive(next);
    setFurthest((f) => Math.max(f, next));
  }

  async function handleNext() {
    if (active === 0 && !step1Valid) {
      setFormError('Add a title before continuing');
      return;
    }
    if (active === 1 && !step2Valid) {
      setFormError('Add at least one application question before continuing');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const id = await persistAll();
      const nextStep = Math.min(active + 1, STEPS.length - 1);
      goToStep(nextStep);
      if (guided) {
        onDraftProgress?.(id, nextStep);
      }
      toastSuccess('Progress saved');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Save failed';
      setFormError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (active !== 2 && active !== 3) return;
    setSaving(true);
    setFormError(null);
    try {
      const id = await persistAll();
      const nextStep = Math.min(active + 1, STEPS.length - 1);
      goToStep(nextStep);
      if (guided) {
        onDraftProgress?.(id, nextStep);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Save failed';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!step1Valid) {
      setFormError('Title is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const id = await persistAll();
      toastSuccess('Job saved');
      onSaved(id);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Save failed';
      setFormError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!step2Valid) {
      setFormError('Add at least one application question before publishing');
      goToStep(1);
      return;
    }
    setPublishing(true);
    setFormError(null);
    try {
      const id = await persistAll();
      await api<HrJobsUpdateResult>(`/api/hr/jobs/${id}`, {
        method: 'PATCH',
        body: { status: 'OPEN' },
      });
      setJobStatus('OPEN');
      setDirty(false);
      toastSuccess('Job published');
      onPublished?.(id);
      if (!guided) {
        onSaved(id);
      } else {
        onDraftProgress?.(id, 4);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Publish failed';
      setFormError(message);
      toastError(message);
    } finally {
      setPublishing(false);
    }
  }

  function onStepperClick(step: number) {
    if (!guided) {
      goToStep(step);
      return;
    }
    if (step <= furthest) {
      goToStep(step);
    }
  }

  const slideOffset = 24 * stepDirection;

  return (
    <Stack gap={density.sectionGap}>
      {jobId && jobStatus ? (
        <Group justify="flex-end">
          <JobStatusBadge status={jobStatus as JobStatus} />
        </Group>
      ) : null}

      {publicUrl && (!guided || active === 4) ? <ShareLinkPanel url={publicUrl} /> : null}

      {dirty ? (
        <Alert color="warning" title="Unsaved changes">
          You have unsaved edits on this job.
        </Alert>
      ) : null}

      {formError ? (
        <Alert color="danger" title="Could not continue">
          {formError}
        </Alert>
      ) : null}

      <Stepper
        active={active}
        onStepClick={onStepperClick}
        allowNextStepsSelect={!guided}
        color="accent"
      >
        {STEPS.map((step, index) => (
          <Stepper.Step
            key={step.label}
            label={step.label}
            description={guided && index > furthest ? undefined : undefined}
            allowStepSelect={!guided || index <= furthest}
          />
        ))}
      </Stepper>

      <Text size="sm" c="dimmed">
        {STEPS[active]?.description}
      </Text>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          initial={{ opacity: 0, x: slideOffset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -slideOffset }}
          transition={motionTransitionFast}
        >
          {active === 0 ? (
            <EditorSection title="Role" description={STEPS[0].description}>
              <BasicsSection
                form={form}
                demographic={demographic}
                onDemographicChange={setDemographic}
                onDirty={markDirty}
                parts={{ role: true, application: false, advanced: false }}
              />
            </EditorSection>
          ) : null}

          {active === 1 ? (
            <Stack gap={density.sectionGap}>
              <EditorSection title="Application questions" description={STEPS[1].description}>
                <QuestionsSection
                  questions={questions}
                  onChange={(rows) => {
                    setQuestions(rows);
                    if (rows.length === 0) {
                      setHardRows([]);
                      setSoftRows([]);
                    }
                  }}
                  onDirty={markDirty}
                />
              </EditorSection>
              <EditorSection title="Application options">
                <BasicsSection
                  form={form}
                  demographic={demographic}
                  onDemographicChange={setDemographic}
                  onDirty={markDirty}
                  parts={{ role: false, application: true, advanced: false }}
                />
              </EditorSection>
            </Stack>
          ) : null}

          {active === 2 ? (
            questionsReady ? (
              <EditorSection title="Screening rules" description={STEPS[2].description}>
                <ScreeningRulesSection
                  hardRows={hardRows}
                  softRows={softRows}
                  fieldOptions={fieldOptions}
                  onHardChange={setHardRows}
                  onSoftChange={setSoftRows}
                  onDirty={markDirty}
                />
                <BasicsSection
                  form={form}
                  demographic={demographic}
                  onDemographicChange={setDemographic}
                  onDirty={markDirty}
                  parts={{ role: false, application: false, advanced: true }}
                />
              </EditorSection>
            ) : (
              <Alert color="ink" title="Add application questions first">
                Screening rules use the fields from your application form. Go back to step 2 and
                add at least one question, then return here.
              </Alert>
            )
          ) : null}

          {active === 3 ? (
            <Stack gap={density.sectionGap}>
              <EditorSection title="Technical assessment" description={STEPS[3].description}>
                <AssessmentSection
                  kind="ASSESSMENT"
                  value={assessment}
                  onChange={setAssessment}
                  onDirty={markDirty}
                />
              </EditorSection>
              <EditorSection
                title="Recorded tech test"
                description="Optional. Same paper builder — used after a technical shortlist."
              >
                <AssessmentSection
                  kind="TECH_TEST"
                  value={techTest}
                  onChange={setTechTest}
                  onDirty={markDirty}
                />
              </EditorSection>
            </Stack>
          ) : null}

          {active === 4 ? (
            <EditorSection title="Review" description={STEPS[4].description}>
              {publicUrl ? null : (
                <JobWizardReview
                  values={form.values}
                  questions={questions}
                  hardRows={hardRows}
                  softRows={softRows}
                  assessment={assessment}
                  techTest={techTest}
                  onEditStep={(step) => goToStep(step)}
                />
              )}
              {publicUrl ? (
                <Text size="sm" c="dimmed">
                  This job is live. Share the link above with candidates.
                </Text>
              ) : null}
            </EditorSection>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <Group justify="space-between" align="center" wrap="wrap" pt="sm">
        <Group gap="sm">
          {guided && active > 0 ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Back to previous step"
              variant="default"
              disabled={saving || publishing}
              onClick={() => goToStep(active - 1)}
            >
              Back
            </MotionButton>
          ) : null}
        </Group>

        <Group gap="sm">
          {guided && (active === 2 || active === 3) ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Skip this optional step"
              variant="subtle"
              disabled={saving || publishing}
              onClick={() => void handleSkip()}
            >
              Skip
            </MotionButton>
          ) : null}

          {guided && active < 4 ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Save and continue to next step"
              loading={saving}
              disabled={
                publishing ||
                (active === 0 && !step1Valid) ||
                (active === 1 && !step2Valid)
              }
              onClick={() => void handleNext()}
            >
              Next
            </MotionButton>
          ) : null}

          {!guided ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Save job"
              loading={saving}
              disabled={publishing || !requiredFieldsComplete}
              onClick={() => void handleSave()}
            >
              Save
            </MotionButton>
          ) : null}

          {active === 4 && jobStatus !== 'OPEN' ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Publish job"
              color="success"
              loading={publishing}
              disabled={saving}
              onClick={() => void handlePublish()}
            >
              Publish
            </MotionButton>
          ) : null}
        </Group>
      </Group>
    </Stack>
  );
}
