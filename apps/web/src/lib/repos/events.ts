import 'server-only';
import { one, query } from '@/lib/db';
import type { NewRecruitmentEvent, RecruitmentEvent } from '@/types/domain';

export async function appendEvent(input: NewRecruitmentEvent): Promise<RecruitmentEvent> {
  const row = await one<RecruitmentEvent>(
    `INSERT INTO HRSYSTEM_recruitment_events (
       application_id, candidate_id, job_id, event_type,
       from_stage, to_stage, actor_type, actor_id, actor_label, payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     RETURNING *`,
    [
      input.application_id ?? null,
      input.candidate_id ?? null,
      input.job_id ?? null,
      input.event_type,
      input.from_stage ?? null,
      input.to_stage ?? null,
      input.actor_type,
      input.actor_id ?? null,
      input.actor_label ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  if (!row) {
    throw new Error('Failed to append recruitment event');
  }
  return row;
}

export async function listEventsByApplication(applicationId: string): Promise<RecruitmentEvent[]> {
  return query<RecruitmentEvent>(
    `SELECT * FROM HRSYSTEM_recruitment_events
     WHERE application_id = $1
     ORDER BY created_at ASC, id ASC`,
    [applicationId],
  );
}
