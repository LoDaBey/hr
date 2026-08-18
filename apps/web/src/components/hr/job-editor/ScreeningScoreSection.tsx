'use client';

import { Group, NumberInput, Stack, Text, Title } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { JobEditorBasicsValues, ScreeningWeights } from '@/types/job-editor';

const WEIGHT_FIELDS: Array<{
  key: keyof ScreeningWeights;
  label: string;
  description: string;
}> = [
  { key: 'skills', label: 'Skills', description: 'Required and preferred skills vs the CV' },
  { key: 'experience', label: 'Experience', description: 'Years and role history' },
  { key: 'answers', label: 'Answers', description: 'Application questions and nice-to-haves' },
  { key: 'education', label: 'Education', description: 'Education vs the role requirement' },
];

export function ScreeningScoreSection({
  form,
  niceToHaveTotal,
  onDirty,
}: {
  form: UseFormReturnType<JobEditorBasicsValues>;
  niceToHaveTotal: number;
  onDirty: () => void;
}) {
  const weights = form.values.screening_weights;
  const weightTotal = weights.skills + weights.experience + weights.answers + weights.education;
  const threshold = Number(form.values.shortlist_threshold) || 70;

  return (
    <Stack gap="md">
      <div>
        <Title order={4}>Overall score</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Screening builds a 0–100 score from the four weights below. Must-haves are pass/fail
          and never add points. Each nice-to-have can add extra points on top. Candidates at or
          above the shortlist threshold are suggested for shortlist — you still decide.
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

      <Text size="sm" c={weightTotal === 100 ? 'dimmed' : 'warning'}>
        Weights currently add up to {weightTotal}
        {weightTotal === 100 ? '. That is the full 100-point score.' : '. Aim for 100.'}
        {niceToHaveTotal > 0
          ? ` Nice-to-haves can add up to ${niceToHaveTotal} extra points.`
          : ''}
      </Text>

      <NumberInput
        className="rounded outline-none"
        label="Shortlist threshold"
        aria-label="Shortlist threshold"
        description={`Suggested shortlist at ${threshold} or above. You always make the final call.`}
        min={0}
        max={100}
        {...form.getInputProps('shortlist_threshold')}
        onChange={(value) => {
          form.setFieldValue('shortlist_threshold', value);
          onDirty();
        }}
      />
    </Stack>
  );
}
