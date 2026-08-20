'use client';

import { Group, NumberInput, Stack, Text, Title } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { JobEditorBasicsValues, ScreeningWeights } from '@/types/job-editor';
import { palette } from '@/theme';

const WEIGHT_FIELDS: Array<{
  key: keyof ScreeningWeights;
  label: string;
  description: string;
}> = [
  { key: 'skills', label: 'Skills', description: 'Required and preferred skills vs the CV' },
  { key: 'experience', label: 'Experience', description: 'Years and role history' },
  { key: 'answers', label: 'Answers', description: 'Application questions vs the criteria' },
  { key: 'education', label: 'Education', description: 'Education vs the role requirement' },
];

export function ScreeningScoreSection({
  form,
  onDirty,
}: {
  form: UseFormReturnType<JobEditorBasicsValues>;
  onDirty: () => void;
}) {
  const weights = form.values.screening_weights;
  const weightTotal = weights.skills + weights.experience + weights.answers + weights.education;
  const rawThreshold = form.values.shortlist_threshold;
  const thresholdEmpty =
    rawThreshold === '' || rawThreshold === null || rawThreshold === undefined;
  const thresholdNum = thresholdEmpty ? null : Number(rawThreshold);

  return (
    <Stack gap="md">
      <div>
        <Title order={4}>Overall score</Title>
        <Text size="sm" mt={4} style={{ color: palette.muted }}>
          Screening builds a 0–100 score from the four weights below. The free-text criteria above
          guide how the AI weighs each area.
        </Text>
      </div>

      <Group grow align="flex-start" wrap="wrap">
        {WEIGHT_FIELDS.map((field) => (
          <NumberInput
            key={field.key}
            className="rounded outline-none"
            label={field.label}
            aria-label={`${field.label} weight`}
            description={field.description}
            min={0}
            max={100}
            value={weights[field.key]}
            onChange={(value) => {
              form.setFieldValue('screening_weights', {
                ...weights,
                [field.key]: Number(value) || 0,
              });
              onDirty();
            }}
          />
        ))}
      </Group>

      <Text
        size="sm"
        c={weightTotal === 100 ? undefined : 'warning'}
        style={weightTotal === 100 ? { color: palette.muted } : undefined}
      >
        Weights currently add up to {weightTotal}
        {weightTotal === 100 ? '. That is the full 100-point score.' : '. Aim for 100.'}
      </Text>

      <NumberInput
        className="rounded outline-none"
        label="Shortlist at or above"
        aria-label="Shortlist at or above"
        description="Candidates at or above this score are shortlisted automatically. Leave blank to use the company default from Settings."
        min={0}
        max={100}
        value={thresholdNum ?? ''}
        onChange={(value) => {
          if (value === '' || value === null || value === undefined) {
            form.setFieldValue('shortlist_threshold', '');
          } else {
            form.setFieldValue('shortlist_threshold', value);
          }
          onDirty();
        }}
      />
    </Stack>
  );
}
