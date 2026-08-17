'use client';

import { MultiSelect, NumberInput, SegmentedControl, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { PublicJobQuestion } from '@/types/api';
import type { ApplyFormValues } from './form-values';

function questionOptions(options: unknown): { value: string; label: string }[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt) };
      }
      if (opt && typeof opt === 'object') {
        const record = opt as { value?: unknown; label?: unknown; text?: unknown };
        const value = String(record.value ?? record.label ?? record.text ?? '');
        const label = String(record.label ?? record.text ?? record.value ?? value);
        return { value, label };
      }
      return { value: String(opt), label: String(opt) };
    })
    .filter((opt) => opt.value);
}

export function QuestionFields({
  form,
  questions,
}: {
  form: UseFormReturnType<ApplyFormValues>;
  questions: PublicJobQuestion[];
}) {
  return (
    <Stack gap="md">
      {questions.map((question) => {
        const path = `answers.${question.key}`;
        const required = question.is_required;
        const data = questionOptions(question.options);

        if (question.type === 'TEXTAREA') {
          return (
            <Textarea
              key={question.id}
              className="rounded outline-none"
              label={question.label}
              aria-label={question.label}
              required={required}
              minRows={4}
              {...form.getInputProps(path)}
            />
          );
        }

        if (question.type === 'NUMBER' || question.type === 'YEARS') {
          return (
            <NumberInput
              key={question.id}
              className="rounded outline-none"
              label={question.label}
              aria-label={question.label}
              required={required}
              min={0}
              decimalScale={question.type === 'YEARS' ? 1 : 0}
              {...form.getInputProps(path)}
            />
          );
        }

        if (question.type === 'SELECT') {
          return (
            <Select
              key={question.id}
              className="rounded outline-none"
              label={question.label}
              aria-label={question.label}
              required={required}
              data={data}
              {...form.getInputProps(path)}
            />
          );
        }

        if (question.type === 'MULTISELECT') {
          return (
            <MultiSelect
              key={question.id}
              className="rounded outline-none"
              label={question.label}
              aria-label={question.label}
              required={required}
              data={data}
              {...form.getInputProps(path)}
            />
          );
        }

        if (question.type === 'BOOLEAN') {
          return (
            <Stack key={question.id} gap={6}>
              <Text size="sm" fw={500}>
                {question.label}
                {required ? ' *' : ''}
              </Text>
              <SegmentedControl
                fullWidth
                aria-label={question.label}
                data={[
                  { label: 'Yes', value: 'true' },
                  { label: 'No', value: 'false' },
                ]}
                {...form.getInputProps(path)}
              />
              {form.errors[path] ? (
                <Text size="sm" c="red">
                  {String(form.errors[path])}
                </Text>
              ) : null}
            </Stack>
          );
        }

        return (
          <TextInput
            key={question.id}
            className="rounded outline-none"
            label={question.label}
            aria-label={question.label}
            required={required}
            {...form.getInputProps(path)}
          />
        );
      })}
    </Stack>
  );
}
