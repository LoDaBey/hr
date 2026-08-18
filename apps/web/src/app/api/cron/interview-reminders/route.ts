import { tx } from '@/lib/db';
import { enqueueCommunication } from '@/lib/repos/communications';
import { jsonError, jsonOk } from '@/lib/http';

export const dynamic = 'force-dynamic';

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('Missing env var: CRON_SECRET');
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

type ReminderRow = {
  id: string;
  application_id: string;
  scheduled_at: string;
  timezone: string;
  meeting_url: string | null;
  candidate_id: string;
  email: string;
  full_name: string;
  title: string;
};

async function claimReminders(
  windowStart: string,
  windowEnd: string,
  stampColumn: 'reminder_24h_sent_at' | 'reminder_2h_sent_at',
): Promise<ReminderRow[]> {
  return tx(async (client) => {
    const res = await client.query<ReminderRow>(
      `SELECT i.id, i.application_id, i.scheduled_at, i.timezone, i.meeting_url,
              a.candidate_id, c.email, c.full_name, j.title
       FROM HRSYSTEM_interviews i
       JOIN HRSYSTEM_applications a ON a.id = i.application_id
       JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
       JOIN HRSYSTEM_jobs j ON j.id = a.job_id
       WHERE i.status = 'SCHEDULED'
         AND i.${stampColumn} IS NULL
         AND i.scheduled_at >= now() + ($1::interval)
         AND i.scheduled_at < now() + ($2::interval)
       FOR UPDATE OF i SKIP LOCKED`,
      [windowStart, windowEnd],
    );

    for (const row of res.rows) {
      await client.query(
        `UPDATE HRSYSTEM_interviews SET ${stampColumn} = now(), updated_at = now() WHERE id = $1`,
        [row.id],
      );
    }
    return res.rows;
  });
}

async function queueReminder(row: ReminderRow, kind: '24h' | '2h') {
  const whenLocal = new Date(row.scheduled_at).toLocaleString('en-GB', {
    timeZone: row.timezone || 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const [datePart, timePart] = whenLocal.split(', ');

  await enqueueCommunication({
    candidate_id: row.candidate_id,
    application_id: row.application_id,
    template_key: 'INTERVIEW_REMINDER',
    to_email: row.email,
    variables: {
      candidate_name: row.full_name,
      job_title: row.title,
      interview_date: datePart ?? row.scheduled_at,
      interview_time: timePart ?? '',
      timezone: row.timezone,
      meeting_url: row.meeting_url ?? '',
    },
    dedupe_key: `${row.application_id}:INTERVIEW_REMINDER:${row.id}:${kind}`,
  });
}

async function runInterviewReminders() {
  const due24h = await claimReminders('23 hours', '25 hours', 'reminder_24h_sent_at');
  const due2h = await claimReminders('105 minutes', '135 minutes', 'reminder_2h_sent_at');

  for (const row of due24h) await queueReminder(row, '24h');
  for (const row of due2h) await queueReminder(row, '2h');

  return {
    reminded_24h: due24h.length,
    reminded_2h: due2h.length,
    queued: due24h.length + due2h.length,
  };
}

async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return jsonError(401, 'UNAUTHENTICATED', 'Invalid cron secret');
  }
  try {
    return jsonOk(await runInterviewReminders());
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Interview reminders failed');
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
