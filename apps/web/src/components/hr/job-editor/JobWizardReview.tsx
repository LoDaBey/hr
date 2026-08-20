'use client';

import { Anchor, Badge, Group, Stack, Text, Title } from '@mantine/core';
import {
  ASSESSMENT_QUESTION_TYPE,
  EMPLOYMENT_TYPE,
  JOB_CURRENCY,
  JOB_QUESTION_TYPE,
  WORK_MODE,
  labelOf,
} from '@/lib/labels';
import { money, date } from '@/lib/format';
import { palette } from '@/theme';
import type {
  AssessmentDraft,
  JobEditorBasicsValues,
  QuestionDraft,
} from '@/types/job-editor';

function assessmentSummary(draft: AssessmentDraft): string {
  const hasAny =
    draft.title.trim() !== '' ||
    draft.instructions.trim() !== '' ||
    draft.questions.length > 0;
  if (!hasAny) return 'None';
  const count = draft.questions.length;
  const minutes = Number(draft.duration_minutes) || 45;
  return `${count} question${count === 1 ? '' : 's'}, ${minutes} minutes`;
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Title order={4}>{title}</Title>
        <Anchor
          component="button"
          type="button"
          size="sm"
          c={palette.accent}
          onClick={onEdit}
          aria-label={`Edit ${title}`}
        >
          Edit
        </Anchor>
      </Group>
      {children}
    </Stack>
  );
}

export function JobWizardReview({
  values,
  questions,
  assessment,
  techTest,
  onEditStep,
}: {
  values: JobEditorBasicsValues;
  questions: QuestionDraft[];
  assessment: AssessmentDraft;
  techTest: AssessmentDraft;
  onEditStep: (step: number) => void;
}) {
  const currency = values.currency || 'USD';
  const salary =
    values.salary_min !== '' || values.salary_max !== ''
      ? `${money(Number(values.salary_min) || null, currency)} – ${money(
          Number(values.salary_max) || null,
          currency,
        )} (${labelOf(JOB_CURRENCY, currency, currency)})`
      : '—';

  return (
    <Stack gap="lg">
      <ReviewBlock title="Role" onEdit={() => onEditStep(0)}>
        <Text fw={600}>{values.title.trim() || 'Untitled role'}</Text>
        <Text size="sm" c="dimmed">
          {[
            values.department || null,
            values.location || null,
            values.employment_type
              ? labelOf(EMPLOYMENT_TYPE, values.employment_type)
              : null,
            values.work_mode ? labelOf(WORK_MODE, values.work_mode) : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'No location details'}
        </Text>
        {values.description ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {values.description}
          </Text>
        ) : null}
        <Text size="sm">Salary: {salary}</Text>
        <Text size="sm">Vacancies: {values.vacancies || '—'}</Text>
        <Text size="sm">Deadline: {date(values.application_deadline)}</Text>
      </ReviewBlock>

      <ReviewBlock title="Application form" onEdit={() => onEditStep(1)}>
        {questions.length === 0 ? (
          <Text size="sm" c="dimmed">
            No questions yet.
          </Text>
        ) : (
          questions.map((q) => (
            <Group key={q.draftId} gap="xs">
              <Text size="sm">{q.label.trim() || 'Untitled'}</Text>
              <Badge size="sm" variant="light" color="ink">
                {labelOf(JOB_QUESTION_TYPE, q.type)}
              </Badge>
              {q.is_required ? (
                <Badge size="sm" variant="outline" color="accent">
                  Required
                </Badge>
              ) : null}
            </Group>
          ))
        )}
        <Text size="sm" c="dimmed">
          CV {values.cv_required ? 'required' : 'optional'}
          {values.ask_age ? ' · asks age' : ''}
          {values.ask_military_status ? ' · asks military status' : ''}
          {values.ask_marital_status ? ' · asks marital status' : ''}
        </Text>
      </ReviewBlock>

      <ReviewBlock title="AI filtering" onEdit={() => onEditStep(2)}>
        <Text size="sm" fw={600}>
          Who you are looking for
        </Text>
        {values.screening_criteria.trim() ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {values.screening_criteria.trim()}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            Not written yet
          </Text>
        )}
        <Text size="sm" fw={600} mt="xs">
          Overall score
        </Text>
        <Text size="sm">
          Skills {values.screening_weights.skills} · Experience {values.screening_weights.experience}{' '}
          · Answers {values.screening_weights.answers} · Education {values.screening_weights.education}
        </Text>
        <Text size="sm" c="dimmed">
          Shortlist at or above:{' '}
          {values.shortlist_threshold === '' ||
          values.shortlist_threshold === null ||
          values.shortlist_threshold === undefined
            ? 'Company default'
            : values.shortlist_threshold}
        </Text>
      </ReviewBlock>

      <ReviewBlock title="Technical assessment" onEdit={() => onEditStep(3)}>
        <Text size="sm">
          {assessmentSummary(assessment)}
          {assessment.title.trim() ? ` (${assessment.title.trim()})` : ''}
        </Text>
        {assessment.questions.length > 0 ? (
          <Stack gap={4} mt="xs">
            {assessment.questions.map((q) => (
              <Text key={q.draftId} size="sm" c="dimmed">
                {labelOf(ASSESSMENT_QUESTION_TYPE, q.type)} —{' '}
                {q.prompt.trim().slice(0, 80) || 'Untitled'}
              </Text>
            ))}
          </Stack>
        ) : null}
      </ReviewBlock>

      <ReviewBlock title="Recorded tech test" onEdit={() => onEditStep(4)}>
        <Text size="sm">
          {assessmentSummary(techTest)}
          {techTest.title.trim() ? ` (${techTest.title.trim()})` : ''}
        </Text>
        {techTest.questions.length > 0 ? (
          <Stack gap={4} mt="xs">
            {techTest.questions.map((q) => (
              <Text key={q.draftId} size="sm" c="dimmed">
                {labelOf(ASSESSMENT_QUESTION_TYPE, q.type)} —{' '}
                {q.prompt.trim().slice(0, 80) || 'Untitled'}
              </Text>
            ))}
          </Stack>
        ) : null}
      </ReviewBlock>
    </Stack>
  );
}
