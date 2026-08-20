'use client';

import { Stack, Text, Textarea } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { JobEditorBasicsValues } from '@/types/job-editor';
import { palette } from '@/theme';

const PLACEHOLDER = `We need a senior full-stack engineer who has actually owned a product end to end, not just worked on tickets. Strong React and Node. Must have shipped something with real users. Experience with AWS matters more than a specific framework. A degree is not important — what they have built is. Comfortable in English on calls with US clients.`;

export function ScreeningCriteriaSection({
  form,
  onDirty,
}: {
  form: UseFormReturnType<JobEditorBasicsValues>;
  onDirty: () => void;
}) {
  return (
    <Stack gap="xs">
      <Textarea
        className="rounded outline-none"
        label="Who are you looking for?"
        aria-label="Who are you looking for?"
        placeholder={PLACEHOLDER}
        autosize
        minRows={10}
        required
        value={form.values.screening_criteria}
        onChange={(e) => {
          form.setFieldValue('screening_criteria', e.currentTarget.value);
          onDirty();
        }}
      />
      <Text size="sm" style={{ color: palette.muted }}>
        Write it as you would explain the role to a colleague. The AI weighs candidates against
        this, in the order of importance you imply.
      </Text>
    </Stack>
  );
}
