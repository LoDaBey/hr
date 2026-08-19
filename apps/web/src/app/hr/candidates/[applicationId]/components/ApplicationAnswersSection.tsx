'use client';

import { Group, Stack, Text } from '@mantine/core';
import {
  formatAnswerValue,
  formatAvailableFrom,
  formatEmploymentStatus,
} from '@/lib/display';
import { money } from '@/lib/format';
import type { HrApplicationAnswers } from '@/types/api';

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <Group align="flex-start" wrap="nowrap">
      <Text fw={600} w={200}>
        {label}
      </Text>
      <Text style={{ whiteSpace: 'pre-wrap' }}>{value}</Text>
    </Group>
  );
}

function Subheading({ children }: { children: string }) {
  return (
    <Text size="sm" fw={700} tt="uppercase" c="dimmed" mt="xs">
      {children}
    </Text>
  );
}

function displayOrDash(value: string | number | null | undefined, formatter?: (v: string) => string): string {
  if (value == null || value === '') return '—';
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null') return '—';
  return formatter ? formatter(text) : text;
}

export function ApplicationAnswersSection({ answers }: { answers: HrApplicationAnswers }) {
  const { personal, professional, questions } = answers;

  return (
    <Stack gap="sm">
      <Subheading>Personal</Subheading>
      <FieldRow label="Full name" value={personal.full_name} />
      <FieldRow label="Email" value={personal.email} />
      <FieldRow label="Phone" value={displayOrDash(personal.phone)} />
      <FieldRow label="Country" value={displayOrDash(personal.country)} />
      <FieldRow label="City" value={displayOrDash(personal.city)} />
      {personal.age != null ? (
        <FieldRow label="Age" value={String(personal.age)} />
      ) : null}
      {personal.military_status != null ? (
        <FieldRow label="Military status" value={displayOrDash(personal.military_status)} />
      ) : null}
      {personal.marital_status != null ? (
        <FieldRow label="Marital status" value={displayOrDash(personal.marital_status)} />
      ) : null}

      <Subheading>Professional</Subheading>
      <FieldRow
        label="Employment status"
        value={formatEmploymentStatus(professional.employment_status)}
      />
      <FieldRow label="Current company" value={displayOrDash(professional.current_company)} />
      <FieldRow label="Current position" value={displayOrDash(professional.current_position)} />
      <FieldRow
        label="Years of experience"
        value={
          professional.years_experience != null
            ? `${professional.years_experience} years`
            : '—'
        }
      />
      <FieldRow
        label="Expected salary"
        value={
          professional.expected_salary != null
            ? money(professional.expected_salary, professional.salary_currency ?? 'USD')
            : '—'
        }
      />
      <FieldRow
        label="Notice period"
        value={
          professional.notice_period_days != null
            ? `${professional.notice_period_days} days`
            : '—'
        }
      />
      <FieldRow
        label="Available from"
        value={formatAvailableFrom(professional.available_from)}
      />

      <Subheading>Questions</Subheading>
      {questions.length === 0 ? (
        <Text c="dimmed">No screening questions configured for this job.</Text>
      ) : (
        questions.map((q) => (
          <FieldRow
            key={q.question_key}
            label={q.label}
            value={
              q.answered
                ? formatAnswerValue(q.answer, professional.salary_currency)
                : 'Not answered'
            }
          />
        ))
      )}
    </Stack>
  );
}
