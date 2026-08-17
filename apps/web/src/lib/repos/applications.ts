import 'server-only';
import { one, query } from '@/lib/db';
import type { Application } from '@/types/domain';

export async function findApplicationById(id: string): Promise<Application | null> {
  return one<Application>(`SELECT * FROM applications WHERE id = $1`, [id]);
}

export async function listApplicationsByJob(jobId: string): Promise<Application[]> {
  return query<Application>(
    `SELECT * FROM applications WHERE job_id = $1 ORDER BY created_at DESC`,
    [jobId],
  );
}

export async function listApplicationsByCandidate(candidateId: string): Promise<Application[]> {
  return query<Application>(
    `SELECT * FROM applications WHERE candidate_id = $1 ORDER BY created_at DESC`,
    [candidateId],
  );
}
