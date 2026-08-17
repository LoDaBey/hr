import 'server-only';
import type { PoolClient } from 'pg';
import { one } from '@/lib/db';
import type { AppSettings } from '@/types/domain';

export async function getAppSettings(client?: PoolClient): Promise<AppSettings> {
  const sql = `SELECT * FROM app_settings WHERE id = true`;
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
  },
  updatedBy: string,
): Promise<AppSettings> {
  const row = await one<AppSettings>(
    `UPDATE app_settings SET
       auto_send_assessment = COALESCE($1, auto_send_assessment),
       auto_send_assessment_delay_minutes = COALESCE($2, auto_send_assessment_delay_minutes),
       auto_send_techtest = COALESCE($3, auto_send_techtest),
       auto_send_techtest_delay_minutes = COALESCE($4, auto_send_techtest_delay_minutes),
       updated_by = $5,
       updated_at = now()
     WHERE id = true
     RETURNING *`,
    [
      patch.auto_send_assessment ?? null,
      patch.auto_send_assessment_delay_minutes ?? null,
      patch.auto_send_techtest ?? null,
      patch.auto_send_techtest_delay_minutes ?? null,
      updatedBy,
    ],
  );
  if (!row) throw new Error('app_settings row missing');
  return row;
}
