'use client';

import { NumberInput, Select, SimpleGrid, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { PublicJobDetail } from '@/types/api';
import { MILITARY_STATUS_OPTIONS } from '@/types/job-editor';
import type { ApplyFormValues } from './form-values';

export type PersonalValues = {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  age: number | string | '';
  military_status: string;
  marital_status: string;
};

const MILITARY_OPTIONS = MILITARY_STATUS_OPTIONS.map((value) => ({ value, label: value }));

export function PersonalFields({
  form,
  job,
}: {
  form: UseFormReturnType<ApplyFormValues>;
  job: PublicJobDetail;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      <TextInput
        className="rounded outline-none"
        label="Full name"
        aria-label="Full name"
        required
        {...form.getInputProps('candidate.full_name')}
      />
      <TextInput
        className="rounded outline-none"
        label="Email"
        aria-label="Email"
        type="email"
        autoComplete="email"
        required
        {...form.getInputProps('candidate.email')}
      />
      <TextInput
        className="rounded outline-none"
        label="Phone"
        aria-label="Phone"
        required
        {...form.getInputProps('candidate.phone')}
      />
      <TextInput
        className="rounded outline-none"
        label="Country"
        aria-label="Country"
        {...form.getInputProps('candidate.country')}
      />
      <TextInput
        className="rounded outline-none"
        label="City"
        aria-label="City"
        {...form.getInputProps('candidate.city')}
      />
      {job.ask_age ? (
        <NumberInput
          className="rounded outline-none"
          label="Age"
          aria-label="Age"
          min={16}
          max={80}
          {...form.getInputProps('candidate.age')}
        />
      ) : null}
      {job.ask_military_status ? (
        <Select
          className="rounded outline-none"
          label="Military status"
          aria-label="Military status"
          data={MILITARY_OPTIONS}
          required
          {...form.getInputProps('candidate.military_status')}
        />
      ) : null}
      {job.ask_marital_status ? (
        <TextInput
          className="rounded outline-none"
          label="Marital status"
          aria-label="Marital status"
          {...form.getInputProps('candidate.marital_status')}
        />
      ) : null}
    </SimpleGrid>
  );
}
