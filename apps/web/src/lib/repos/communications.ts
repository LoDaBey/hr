import 'server-only';
import type { PoolClient } from 'pg';
import { one, query, tx } from '@/lib/db';
import type { Communication, NewCommunication } from '@/types/domain';

export async function findCommunicationById(id: string): Promise<Communication | null> {
  return one<Communication>(`SELECT * FROM HRSYSTEM_communications WHERE id = $1`, [id]);
}

export async function enqueueCommunicationTx(
  client: PoolClient,
  input: NewCommunication,
): Promise<void> {
  await client.query(
    `INSERT INTO HRSYSTEM_communications (
       candidate_id, application_id, template_key, to_email,
       subject, variables, dedupe_key, scheduled_for
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::timestamptz, now()))
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [
      input.candidate_id ?? null,
      input.application_id ?? null,
      input.template_key,
      input.to_email,
      input.subject ?? null,
      JSON.stringify(input.variables ?? {}),
      input.dedupe_key,
      input.scheduled_for ?? null,
    ],
  );
}

export async function enqueueCommunication(input: NewCommunication): Promise<Communication> {
  const inserted = await one<Communication>(
    `INSERT INTO HRSYSTEM_communications (
       candidate_id, application_id, template_key, to_email,
       subject, variables, dedupe_key, scheduled_for
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8::timestamptz, now()))
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING *`,
    [
      input.candidate_id ?? null,
      input.application_id ?? null,
      input.template_key,
      input.to_email,
      input.subject ?? null,
      JSON.stringify(input.variables ?? {}),
      input.dedupe_key,
      input.scheduled_for ?? null,
    ],
  );
  if (inserted) return inserted;

  console.warn('[enqueueCommunication] dedupe_key conflict — returning existing row', {
    dedupe_key: input.dedupe_key,
    template_key: input.template_key,
  });

  const existing = await one<Communication>(
    `SELECT * FROM HRSYSTEM_communications WHERE dedupe_key = $1`,
    [input.dedupe_key],
  );
  if (!existing) {
    throw new Error('Failed to enqueue communication');
  }
  return existing;
}

export async function listCommunicationsByApplication(
  applicationId: string,
): Promise<Communication[]> {
  return query<Communication>(
    `SELECT * FROM HRSYSTEM_communications
     WHERE application_id = $1
     ORDER BY created_at DESC`,
    [applicationId],
  );
}

export async function claimPendingCommunications(limit = 20): Promise<Communication[]> {
  return tx(async (client) => {
    const res = await client.query<Communication>(
      `UPDATE HRSYSTEM_communications SET attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM HRSYSTEM_communications
         WHERE status = 'PENDING' AND attempts < 3 AND scheduled_for <= now()
         ORDER BY created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit],
    );
    return res.rows;
  });
}

export async function claimCommunicationForSend(
  id: string,
  client?: PoolClient,
): Promise<Communication | null> {
  const sql = `
    UPDATE HRSYSTEM_communications
    SET attempts = attempts + 1,
        scheduled_for = now()
    WHERE id IN (
      SELECT c.id
      FROM HRSYSTEM_communications c
      WHERE c.id = $1
        AND c.status = 'PENDING'
        AND c.attempts < 3
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;

  if (client) {
    const res = await client.query<Communication>(sql, [id]);
    return res.rows[0] ?? null;
  }

  return tx(async (c) => {
    const res = await c.query<Communication>(sql, [id]);
    return res.rows[0] ?? null;
  });
}

export async function markCommunicationSent(
  id: string,
  gmailMessageId: string,
): Promise<Communication | null> {
  return one<Communication>(
    `UPDATE HRSYSTEM_communications
     SET status = 'SENT',
         gmail_message_id = $2,
         sent_at = now(),
         last_error = NULL
     WHERE id = $1
     RETURNING *`,
    [id, gmailMessageId],
  );
}

export async function markCommunicationFailed(
  id: string,
  error: string,
): Promise<Communication | null> {
  return one<Communication>(
    `UPDATE HRSYSTEM_communications
     SET last_error = $2,
         status = CASE WHEN attempts >= 3 THEN 'FAILED'::HRSYSTEM_comm_status ELSE status END
     WHERE id = $1
     RETURNING *`,
    [id, error],
  );
}

export async function listFailedCommunications(limit = 50): Promise<
  Array<{
    id: string;
    template_key: string;
    to_email: string;
    subject: string | null;
    last_error: string | null;
    attempts: number;
    application_id: string | null;
    created_at: string;
  }>
> {
  return query(
    `SELECT id, template_key, to_email, subject, last_error, attempts, application_id, created_at
     FROM HRSYSTEM_communications
     WHERE status = 'FAILED'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
}
