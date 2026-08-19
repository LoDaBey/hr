'use client';

import {
  Group,
  MultiSelect,
  NumberInput,
  Stack,
  TagsInput,
  TextInput,
  Textarea,
  Select,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { UseFormReturnType } from '@mantine/form';
import { CheckboxReveal } from '@/components/hr/job-editor/CheckboxReveal';
import { EMPLOYMENT_TYPE, JOB_CURRENCY, JOB_DEPARTMENT, WORK_MODE, selectOptions, withCurrentSelectOption } from '@/lib/labels';
import type {
  BasicsSectionParts,
  DemographicRuleState,
  JobEditorBasicsValues,
} from '@/types/job-editor';
import { MILITARY_STATUS_OPTIONS, ON_FAIL_OPTIONS } from '@/types/job-editor';

export function BasicsSection({
  form,
  demographic,
  onDemographicChange,
  onDirty,
  parts,
}: {
  form: UseFormReturnType<JobEditorBasicsValues>;
  demographic: DemographicRuleState;
  onDemographicChange: (next: DemographicRuleState) => void;
  onDirty: () => void;
  parts?: BasicsSectionParts;
}) {
  const showRole = parts?.role !== false;
  const showApplication = parts?.application !== false;
  const askAge = form.values.ask_age;
  const askMilitary = form.values.ask_military_status;
  const askMarital = form.values.ask_marital_status;

  return (
    <Stack gap="sm">
      {showRole ? (
        <>
          <TextInput
            className="rounded outline-none"
            label="Title"
            aria-label="Job title"
            required
            {...form.getInputProps('title')}
            onChange={(e) => {
              form.setFieldValue('title', e.currentTarget.value);
              onDirty();
            }}
          />
          <Group grow>
            <Select
              className="rounded outline-none"
              label="Department"
              aria-label="Department"
              data={withCurrentSelectOption(
                selectOptions(JOB_DEPARTMENT),
                form.values.department,
              )}
              clearable
              searchable
              {...form.getInputProps('department')}
              onChange={(value) => {
                form.setFieldValue('department', value ?? '');
                onDirty();
              }}
            />
            <TextInput
              className="rounded outline-none"
              label="Location"
              aria-label="Location"
              {...form.getInputProps('location')}
              onChange={(e) => {
                form.setFieldValue('location', e.currentTarget.value);
                onDirty();
              }}
            />
          </Group>
          <Group grow>
            <Select
              className="rounded outline-none"
              label="Employment type"
              aria-label="Employment type"
              data={selectOptions(EMPLOYMENT_TYPE)}
              clearable
              {...form.getInputProps('employment_type')}
              onChange={(value) => {
                form.setFieldValue('employment_type', value);
                onDirty();
              }}
            />
            <Select
              className="rounded outline-none"
              label="Work mode"
              aria-label="Work mode"
              data={selectOptions(WORK_MODE)}
              clearable
              {...form.getInputProps('work_mode')}
              onChange={(value) => {
                form.setFieldValue('work_mode', value);
                onDirty();
              }}
            />
          </Group>
          <Textarea
            className="rounded outline-none"
            label="Description"
            aria-label="Job description"
            autosize
            minRows={8}
            maxRows={20}
            {...form.getInputProps('description')}
            onChange={(e) => {
              form.setFieldValue('description', e.currentTarget.value);
              onDirty();
            }}
          />
          <NumberInput
            className="rounded outline-none"
            label="Min experience (years)"
            aria-label="Minimum experience years"
            {...form.getInputProps('min_experience_years')}
            onChange={(value) => {
              form.setFieldValue('min_experience_years', value);
              onDirty();
            }}
          />
          <TagsInput
            className="rounded outline-none"
            label="Required skills"
            aria-label="Required skills"
            placeholder="Type a skill and press Enter"
            {...form.getInputProps('required_skills')}
            onChange={(value) => {
              form.setFieldValue('required_skills', value);
              onDirty();
            }}
          />
          <Group grow>
            <NumberInput
              className="rounded outline-none"
              label="Salary min"
              aria-label="Salary minimum"
              min={0}
              {...form.getInputProps('salary_min')}
              onChange={(value) => {
                form.setFieldValue('salary_min', value === '' || value == null ? '' : value);
                onDirty();
              }}
            />
            <NumberInput
              className="rounded outline-none"
              label="Salary max"
              aria-label="Salary maximum"
              min={0}
              {...form.getInputProps('salary_max')}
              onChange={(value) => {
                form.setFieldValue('salary_max', value === '' || value == null ? '' : value);
                onDirty();
              }}
            />
            <Select
              className="rounded outline-none"
              label="Currency"
              aria-label="Salary currency"
              data={withCurrentSelectOption(selectOptions(JOB_CURRENCY), form.values.currency)}
              clearable={false}
              {...form.getInputProps('currency')}
              onChange={(value) => {
                form.setFieldValue('currency', value ?? 'USD');
                onDirty();
              }}
            />
          </Group>
          <Group grow>
            <NumberInput
              className="rounded outline-none"
              label="Vacancies"
              aria-label="Number of vacancies"
              min={1}
              {...form.getInputProps('vacancies')}
              onChange={(value) => {
                form.setFieldValue('vacancies', value === '' || value == null ? 1 : value);
                onDirty();
              }}
            />
            <DateInput
              className="rounded outline-none"
              label="Application deadline"
              aria-label="Application deadline"
              clearable
              value={
                form.values.application_deadline
                  ? new Date(form.values.application_deadline)
                  : null
              }
              onChange={(value) => {
                form.setFieldValue(
                  'application_deadline',
                  value ? new Date(value).toISOString() : null,
                );
                onDirty();
              }}
            />
          </Group>
        </>
      ) : null}

      {showApplication ? (
        <>
          <CheckboxReveal
            label="CV required"
            description="Candidates must upload a CV with their application."
            checked={form.values.cv_required}
            onCheckedChange={(checked) => {
              form.setFieldValue('cv_required', checked);
              onDirty();
            }}
          />

          <CheckboxReveal
            label="Ask age"
            description="Collect age on the application. Optional min/max become screening rules."
            checked={askAge}
            onCheckedChange={(checked) => {
              form.setFieldValue('ask_age', checked);
              onDirty();
            }}
          >
            <Group grow align="flex-end">
              <NumberInput
                className="rounded outline-none"
                label="Minimum age"
                aria-label="Minimum age"
                min={0}
                disabled={!askAge}
                value={demographic.ageMin === '' ? undefined : demographic.ageMin}
                onChange={(value) => {
                  onDemographicChange({
                    ...demographic,
                    ageMin: value === '' || value == null ? '' : value,
                  });
                  onDirty();
                }}
              />
              <NumberInput
                className="rounded outline-none"
                label="Maximum age"
                aria-label="Maximum age"
                min={0}
                disabled={!askAge}
                value={demographic.ageMax === '' ? undefined : demographic.ageMax}
                onChange={(value) => {
                  onDemographicChange({
                    ...demographic,
                    ageMax: value === '' || value == null ? '' : value,
                  });
                  onDirty();
                }}
              />
              <Select
                className="rounded outline-none"
                label="If not met"
                aria-label="Age rule if not met"
                data={ON_FAIL_OPTIONS}
                disabled={!askAge}
                value={demographic.ageOnFail}
                onChange={(value) => {
                  if (!value) return;
                  onDemographicChange({
                    ...demographic,
                    ageOnFail: value as DemographicRuleState['ageOnFail'],
                  });
                  onDirty();
                }}
              />
            </Group>
          </CheckboxReveal>

          <CheckboxReveal
            label="Ask military status"
            description="Collect military status. Choose which values pass screening."
            checked={askMilitary}
            onCheckedChange={(checked) => {
              form.setFieldValue('ask_military_status', checked);
              onDirty();
            }}
          >
            <Group grow align="flex-end">
              <MultiSelect
                className="rounded outline-none"
                label="Accepted values"
                aria-label="Accepted military status values"
                data={[...MILITARY_STATUS_OPTIONS]}
                disabled={!askMilitary}
                value={demographic.militaryAccepted}
                onChange={(value) => {
                  onDemographicChange({ ...demographic, militaryAccepted: value });
                  onDirty();
                }}
              />
              <Select
                className="rounded outline-none"
                label="If not met"
                aria-label="Military status rule if not met"
                data={ON_FAIL_OPTIONS}
                disabled={!askMilitary}
                value={demographic.militaryOnFail}
                onChange={(value) => {
                  if (!value) return;
                  onDemographicChange({
                    ...demographic,
                    militaryOnFail: value as DemographicRuleState['militaryOnFail'],
                  });
                  onDirty();
                }}
              />
            </Group>
          </CheckboxReveal>

          <CheckboxReveal
            label="Ask marital status"
            description="Collected for records. Not used in scoring."
            checked={askMarital}
            onCheckedChange={(checked) => {
              form.setFieldValue('ask_marital_status', checked);
              onDirty();
            }}
          />
        </>
      ) : null}
    </Stack>
  );
}
