'use client';

import { NumberInput, Select, SimpleGrid, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { UseFormReturnType } from '@mantine/form';
import { CANDIDATE_EMPLOYMENT_STATUS, selectOptions } from '@/lib/labels';
import type { ApplyFormValues } from './form-values';

const EMPLOYMENT_OPTIONS = selectOptions({ ...CANDIDATE_EMPLOYMENT_STATUS });

export type ProfessionalValues = {
  employment_status: string;
  current_company: string;
  current_position: string;
  years_experience: number | string | '';
  expected_salary: number | string | '';
  notice_period_days: number | string | '';
  available_from: Date | string | null;
};

export function ProfessionalFields({
  form,
}: {
  form: UseFormReturnType<ApplyFormValues>;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      <Select
        className="rounded outline-none"
        label="Employment status"
        aria-label="Employment status"
        data={EMPLOYMENT_OPTIONS}
        clearable
        {...form.getInputProps('professional.employment_status')}
      />
      <TextInput
        className="rounded outline-none"
        label="Current company"
        aria-label="Current company"
        {...form.getInputProps('professional.current_company')}
      />
      <TextInput
        className="rounded outline-none"
        label="Current position"
        aria-label="Current position"
        {...form.getInputProps('professional.current_position')}
      />
      <NumberInput
        className="rounded outline-none"
        label="Years of experience"
        aria-label="Years of experience"
        required
        min={0}
        max={50}
        decimalScale={1}
        {...form.getInputProps('professional.years_experience')}
      />
      <NumberInput
        className="rounded outline-none"
        label="Expected salary"
        aria-label="Expected salary"
        min={0}
        {...form.getInputProps('professional.expected_salary')}
      />
      <NumberInput
        className="rounded outline-none"
        label="Notice period (days)"
        aria-label="Notice period in days"
        min={0}
        {...form.getInputProps('professional.notice_period_days')}
      />
      <DateInput
        className="rounded outline-none"
        label="Available from"
        aria-label="Available from"
        valueFormat="YYYY-MM-DD"
        clearable
        {...form.getInputProps('professional.available_from')}
      />
    </SimpleGrid>
  );
}
