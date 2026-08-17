import { pool, tx } from '@/lib/db';
import { enqueueCommunication } from '@/lib/repos/communications';
import { jsonError, jsonOk } from '@/lib/http';
import type { QueryResultRow } from 'pg';

export const dynamic = 'force-dynamic';

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('Missing env var: CRON_SECRET');
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function one<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await pool.query<T>(sql, params);
  return res.rows[0] ?? null;
}

async function expireBatch(
  whereSql: string,
): Promise<Array<{ id: string; application_id: string; kind: 'ASSESSMENT' | 'TECH_TEST' }>> {
  return tx(async (client) => {
    const claimed = await client.query<{ id: string }>(
      `SELECT id FROM candidate_assessments
       WHERE ${whereSql}
       FOR UPDATE SKIP LOCKED`,
    );
    if (claimed.rows.length === 0) return [];

    const ids = claimed.rows.map((r) => r.id);
    const updated = await client.query<{
      id: string;
      application_id: string;
      kind: 'ASSESSMENT' | 'TECH_TEST';
    }>(
      `UPDATE candidate_assessments
       SET status = 'EXPIRED', updated_at = now()
       WHERE id = ANY($1::uuid[])
       RETURNING id, application_id, kind`,
      [ids],
    );
    return updated.rows;
  });
}

async function runDeadlineMonitor() {
  const expiredInvited = await expireBatch(`status = 'INVITED' AND invite_deadline < now()`);
  const expiredStarted = await expireBatch(
    `status = 'STARTED' AND expires_at IS NOT NULL AND expires_at < now() - interval '5 minutes'`,
  );

  let expiredEmails = 0;
  for (const row of [...expiredInvited, ...expiredStarted]) {
    const stage =
      row.kind === 'TECH_TEST' ? 'RECORDED_TECH_EXPIRED' : 'TECH_ASSESSMENT_EXPIRED';

    const app = await one<{
      id: string;
      stage: string;
      candidate_id: string;
      job_id: string;
      email: string;
      full_name: string;
      title: string;
    }>(
      `SELECT a.id, a.stage, a.candidate_id, a.job_id, c.email, c.full_name, j.title
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1`,
      [row.application_id],
    );
    if (!app) continue;

    await pool.query(
      `UPDATE applications
       SET stage = $2::app_stage, updated_at = now()
       WHERE id = $1 AND status = 'ACTIVE'`,
      [row.application_id, stage],
    );

    await pool.query(
      `INSERT INTO recruitment_events (
         application_id, candidate_id, job_id, event_type,
         from_stage, to_stage, actor_type, actor_label, payload
       ) VALUES (
         $1, $2, $3, 'ASSESSMENT_EXPIRED',
         $4::app_stage, $5::app_stage, 'SYSTEM', 'deadline-monitor', $6::jsonb
       )`,
      [
        app.id,
        app.candidate_id,
        app.job_id,
        app.stage,
        stage,
        JSON.stringify({ candidate_assessment_id: row.id, kind: row.kind }),
      ],
    );

    await enqueueCommunication({
      candidate_id: app.candidate_id,
      application_id: row.application_id,
      template_key: 'ASSESSMENT_EXPIRED',
      to_email: app.email,
      variables: {
        candidate_name: app.full_name,
        job_title: app.title,
      },
      dedupe_key: `${row.application_id}:ASSESSMENT_EXPIRED:${row.id}`,
    });
    expiredEmails += 1;
  }

  const reminders = await tx(async (client) => {
    const claimed = await client.query<{
      id: string;
      application_id: string;
      invite_deadline: string;
      email: string;
      full_name: string;
      title: string;
      candidate_id: string;
    }>(
      `SELECT ca.id, ca.application_id, ca.invite_deadline,
              c.email, c.full_name, j.title, a.candidate_id
       FROM candidate_assessments ca
       JOIN applications a ON a.id = ca.application_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE ca.status = 'INVITED'
         AND ca.reminder_sent_at IS NULL
         AND ca.invite_deadline BETWEEN now() AND now() + interval '12 hours'
       FOR UPDATE OF ca SKIP LOCKED`,
    );

    for (const row of claimed.rows) {
      await client.query(
        `UPDATE candidate_assessments
         SET reminder_sent_at = now(), updated_at = now()
         WHERE id = $1`,
        [row.id],
      );
    }
    return claimed.rows;
  });

  let reminderEmails = 0;
  for (const row of reminders) {
    await enqueueCommunication({
      candidate_id: row.candidate_id,
      application_id: row.application_id,
      template_key: 'ASSESSMENT_REMINDER',
      to_email: row.email,
      variables: {
        candidate_name: row.full_name,
        job_title: row.title,
        assessment_deadline: row.invite_deadline,
        assessment_link: '',
      },
      dedupe_key: `${row.application_id}:ASSESSMENT_REMINDER:${row.id}`,
    });
    reminderEmails += 1;
  }

  return {
    expired_invited: expiredInvited.length,
    expired_started: expiredStarted.length,
    expired_emails: expiredEmails,
    reminders: reminderEmails,
  };
}

async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return jsonError(401, 'UNAUTHENTICATED', 'Invalid cron secret');
  }
  try {
    return jsonOk(await runDeadlineMonitor());
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Deadline monitor failed');
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
