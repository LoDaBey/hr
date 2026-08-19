import 'server-only';
import type { PoolClient } from 'pg';
import { one } from '@/lib/db';
import type { AppSettings } from '@/types/domain';

export async function getAppSettings(client?: PoolClient): Promise<AppSettings> {
  const sql = `SELECT * FROM HRSYSTEM_app_settings WHERE id = true`;
  if (client) {
    const res = await client.query<AppSettings>(sql);
    const row = res.rows[0];
    if (!row) throw new Error('app_settings row missing');
    return row;
  }
  const row = await one<AppSettings>(sql);
  if (!row) throw new Error('app_settings row missing');
  return row;
}

export async function updateAppSettings(
  patch: {
    auto_send_assessment?: boolean;
    auto_send_assessment_delay_minutes?: number;
    auto_send_techtest?: boolean;
    auto_send_techtest_delay_minutes?: number;
    auto_reject_hard_fail?: boolean;
    auto_shortlist_enabled?: boolean;
    auto_shortlist_min_score?: number;
    auto_shortlist_min_confidence?: number;
    auto_reject_max_score?: number;
  },
  updatedBy: string,
): Promise<AppSettings> {
  const row = await one<AppSettings>(
    `UPDATE HRSYSTEM_app_settings SET
       auto_send_assessment = COALESCE($1, auto_send_assessment),
       auto_send_assessment_delay_minutes = COALESCE($2, auto_send_assessment_delay_minutes),
       auto_send_techtest = COALESCE($3, auto_send_techtest),
       auto_send_techtest_delay_minutes = COALESCE($4, auto_send_techtest_delay_minutes),
       auto_reject_hard_fail = COALESCE($5, auto_reject_hard_fail),
       auto_shortlist_enabled = COALESCE($6, auto_shortlist_enabled),
       auto_shortlist_min_score = COALESCE($7, auto_shortlist_min_score),
       auto_shortlist_min_confidence = COALESCE($8, auto_shortlist_min_confidence),
       auto_reject_max_score = COALESCE($9, auto_reject_max_score),
       updated_by = $10,
       updated_at = now()
     WHERE id = true
     RETURNING *`,
    [
      patch.auto_send_assessment ?? null,
      patch.auto_send_assessment_delay_minutes ?? null,
      patch.auto_send_techtest ?? null,
      patch.auto_send_techtest_delay_minutes ?? null,
      patch.auto_reject_hard_fail ?? null,
      patch.auto_shortlist_enabled ?? null,
      patch.auto_shortlist_min_score ?? null,
      patch.auto_shortlist_min_confidence ?? null,
      patch.auto_reject_max_score ?? null,
      updatedBy,
    ],
  );
  if (!row) throw new Error('app_settings row missing');
  return row;
}
