import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const cvSchema = z.object({
  public_id: z.string().min(1),
  resource_type: z.string().min(1),
  delivery_type: z.string().min(1),
  format: z.string().min(1),
  bytes: z.number(),
  original_name: z.string().min(1),
});

export const applicationSubmitSchema = z.object({
  idempotency_key: z.string().min(1),
  job_id: z.uuid(),
  candidate: z.object({
    full_name: z.string().trim().min(1),
    email: z.email().transform((value) => value.trim().toLowerCase()),
    phone: z.string().trim().min(1),
    country: optionalText,
    city: optionalText,
    age: z.number().int().positive().nullable().optional(),
    military_status: z.string().nullable().optional(),
    marital_status: z.string().nullable().optional(),
  }),
  professional: z
    .object({
      employment_status: optionalText,
      current_company: optionalText,
      current_position: optionalText,
      years_experience: z.number().optional(),
      expected_salary: z.number().optional(),
      notice_period_days: z.number().int().optional(),
      available_from: optionalText,
    })
    .optional(),
  answers: z.record(z.string(), z.unknown()).optional().default({}),
  cv: cvSchema.optional(),
});

export type ApplicationSubmitInput = z.infer<typeof applicationSubmitSchema>;
