import { z } from 'zod';
import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { getAppSettings, updateAppSettings } from '@/lib/repos/app-settings';
import type { HrSettingsResult } from '@/types/api';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  auto_send_assessment: z.boolean().optional(),
  auto_send_assessment_delay_minutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
  auto_send_techtest: z.boolean().optional(),
  auto_send_techtest_delay_minutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
  auto_reject_hard_fail: z.boolean().optional(),
  auto_shortlist_enabled: z.boolean().optional(),
  auto_shortlist_min_score: z.number().int().min(0).max(100).optional(),
  auto_shortlist_min_confidence: z.number().min(0).max(1).optional(),
  auto_reject_max_score: z.number().int().min(0).max(100).optional(),
});

function toResult(row: Awaited<ReturnType<typeof getAppSettings>>): HrSettingsResult {
  return {
    auto_send_assessment: row.auto_send_assessment,
    auto_send_assessment_delay_minutes: row.auto_send_assessment_delay_minutes,
    auto_send_techtest: row.auto_send_techtest,
    auto_send_techtest_delay_minutes: row.auto_send_techtest_delay_minutes,
    auto_reject_hard_fail: row.auto_reject_hard_fail,
    auto_shortlist_enabled: row.auto_shortlist_enabled,
    auto_shortlist_min_score: row.auto_shortlist_min_score,
    auto_shortlist_min_confidence: Number(row.auto_shortlist_min_confidence),
    auto_reject_max_score: row.auto_reject_max_score,
    updated_at: row.updated_at,
  };
}

export async function GET() {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const settings = await getAppSettings();
    return jsonOk(toResult(settings));
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load settings');
  }
}

export async function PATCH(req: Request) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
    ];
    return jsonError(400, 'VALIDATION_FAILED', 'Validation failed', { fields });
  }

  try {
    const settings = await updateAppSettings(parsed.data, user.id);
    return jsonOk(toResult(settings));
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to update settings');
  }
}
