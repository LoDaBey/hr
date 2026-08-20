'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Paper, Stack } from '@mantine/core';
import { schemaResolver, useForm } from '@mantine/form';
import dayjs from 'dayjs';
import { z } from 'zod';
import { CvUpload } from '@/components/CvUpload';
import { MotionButton } from '@/components/MotionButton';
import { ApiError } from '@/lib/api';
import { useSubmitApplication } from '@/hooks/useSubmitApplication';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette, shadows } from '@/theme';
import type { ApplicationCvInput, PublicJobDetail, PublicJobQuestion } from '@/types/api';
import { ApplyFormBlock } from './ApplyFormBlock';
import { ApplyHeader } from './ApplyHeader';
import { PersonalFields } from './PersonalFields';
import { ProfessionalFields } from './ProfessionalFields';
import { QuestionFields } from './QuestionFields';
import type { ApplyFormValues } from './form-values';

function asNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dayjs(value).format('YYYY-MM-DD');
  }
  if (typeof value === 'string' && value.trim()) return dayjs(value).format('YYYY-MM-DD');
  return undefined;
}

function normalizeAnswer(question: PublicJobQuestion, value: unknown): unknown {
  if (question.type === 'BOOLEAN') {
    if (value === true || value === 'true' || value === 'yes') return true;
    if (value === false || value === 'false' || value === 'no') return false;
    return value;
  }
  if (question.type === 'NUMBER' || question.type === 'YEARS') {
    return asNumber(value);
  }
  return value;
}

function buildSchema(job: PublicJobDetail, questions: PublicJobQuestion[]) {
  const answersShape: Record<string, z.ZodType> = {};
  for (const question of questions) {
    let field: z.ZodType;
    switch (question.type) {
      case 'NUMBER':
      case 'YEARS':
        field = z.coerce.number();
        break;
      case 'BOOLEAN':
        field = z.string().min(1, 'Please choose an option');
        break;
      case 'MULTISELECT':
        field = z.array(z.string());
        break;
      default:
        field = z.string();
    }
    if (question.is_required) {
      if (question.type === 'TEXT' || question.type === 'TEXTAREA' || question.type === 'SELECT') {
        field = z.string().trim().min(1, 'This field is required');
      } else if (question.type === 'MULTISELECT') {
        field = z.array(z.string()).min(1, 'This field is required');
      }
    } else {
      field = field.optional();
    }
    answersShape[question.key] = field;
  }

  return z.object({
    candidate: z.object({
      full_name: z.string().trim().min(1, 'Full name is required'),
      email: z.email('Enter a valid email'),
      phone: z.string().trim().min(1, 'Phone is required'),
      country: z.string().optional(),
      city: z.string().optional(),
      age: job.ask_age ? z.coerce.number().int().positive() : z.any().optional(),
      military_status: job.ask_military_status
        ? z.string().trim().min(1, 'Military status is required')
        : z.string().optional(),
      marital_status: job.ask_marital_status
        ? z.string().trim().min(1, 'Marital status is required')
        : z.string().optional(),
    }),
    professional: z.object({
      employment_status: z.string().optional(),
      current_company: z.string().optional(),
      current_position: z.string().optional(),
      years_experience: z.coerce.number({ error: 'Years of experience is required' }),
      expected_salary: z.any().optional(),
      notice_period_days: z.any().optional(),
      available_from: z.any().optional().nullable(),
    }),
    answers: z.object(answersShape),
  });
}

function defaultAnswers(questions: PublicJobQuestion[]): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const question of questions) {
    if (question.type === 'MULTISELECT') answers[question.key] = [];
    else if (question.type === 'BOOLEAN') answers[question.key] = '';
    else answers[question.key] = '';
  }
  return answers;
}

export function ApplyForm({
  job,
  questions,
}: {
  job: PublicJobDetail;
  questions: PublicJobQuestion[];
}) {
  const router = useRouter();
  const submitApplication = useSubmitApplication();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [cv, setCv] = useState<ApplicationCvInput | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ApplyFormValues>({
    initialValues: {
      candidate: {
        full_name: '',
        email: '',
        phone: '',
        country: '',
        city: '',
        age: '',
        military_status: '',
        marital_status: '',
      },
      professional: {
        employment_status: '',
        current_company: '',
        current_position: '',
        years_experience: '',
        expected_salary: '',
        notice_period_days: '',
        available_from: null,
      },
      answers: defaultAnswers(questions),
    },
    validate: schemaResolver(buildSchema(job, questions), { sync: true }),
  });

  async function handleSubmit(values: ApplyFormValues) {
    if (job.cv_required && !cv) {
      toastError('Please upload your CV before submitting.');
      return;
    }
    setSubmitting(true);
    const answers: Record<string, unknown> = {};
    for (const question of questions) {
      answers[question.key] = normalizeAnswer(question, values.answers[question.key]);
    }

    try {
      await submitApplication({
        idempotency_key: idempotencyKey,
        job_id: job.id,
        candidate: {
          full_name: values.candidate.full_name,
          email: values.candidate.email,
          phone: values.candidate.phone,
          country: values.candidate.country || undefined,
          city: values.candidate.city || undefined,
          age: asNumber(values.candidate.age) ?? null,
          military_status: values.candidate.military_status || null,
          marital_status: values.candidate.marital_status || null,
        },
        professional: {
          employment_status: values.professional.employment_status || undefined,
          current_company: values.professional.current_company || undefined,
          current_position: values.professional.current_position || undefined,
          years_experience: asNumber(values.professional.years_experience),
          expected_salary: asNumber(values.professional.expected_salary),
          notice_period_days: asNumber(values.professional.notice_period_days),
          available_from: asDateString(values.professional.available_from),
        },
        answers,
        cv: cv ?? undefined,
      });
      toastSuccess('Application submitted');
      router.push('/application/success');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'DUPLICATE_APPLICATION') {
          toastError('You have already applied to this role.');
        } else if (error.code === 'JOB_CLOSED' || error.code === 'DEADLINE_PASSED') {
          toastError('Applications for this role are closed.');
        } else if (error.code === 'UPLOAD_INCOMPLETE') {
          toastError('Please upload your CV before submitting.');
        } else if (error.code === 'VALIDATION_FAILED') {
          for (const field of error.fields ?? []) {
            form.setFieldError(field, 'This field is invalid');
          }
          toastError('Please check the highlighted fields.');
        } else if (error.code === 'RATE_LIMITED') {
          toastError('Too many applications from this network. Try again later.');
        } else {
          toastError(error.message);
        }
      } else {
        toastError('Could not submit your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack gap={40}>
      <ApplyHeader job={job} />

      <Paper
        p={{ base: 'md', sm: 'xl' }}
        radius="lg"
        style={{
          background: palette.surface,
          border: `1px solid ${palette.border}`,
          boxShadow: shadows.md,
        }}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap={density.sectionGap}>
            <ApplyFormBlock title="Personal">
              <PersonalFields form={form} job={job} />
            </ApplyFormBlock>

            <ApplyFormBlock title="Professional">
              <ProfessionalFields form={form} />
            </ApplyFormBlock>

            {questions.length > 0 ? (
              <ApplyFormBlock title="Questions">
                <QuestionFields form={form} questions={questions} />
              </ApplyFormBlock>
            ) : null}

            <ApplyFormBlock title="CV">
              <CvUpload
                required={job.cv_required}
                value={cv}
                onChange={setCv}
                onUploadingChange={setUploading}
              />
            </ApplyFormBlock>

            <MotionButton
              type="submit"
              className="cursor-pointer rounded-lg"
              aria-label={`Submit application for ${job.title}`}
              loading={submitting}
              disabled={uploading || submitting || (job.cv_required && !cv)}
            >
              Submit application
            </MotionButton>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
