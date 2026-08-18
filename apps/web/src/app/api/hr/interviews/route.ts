import { requireHr } from '@/lib/auth-hr';
import { query } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import type { HrInterviewsListResult } from '@/types/api';
import type { Interview, Stage } from '@/types/domain';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const [upcoming, awaiting] = await Promise.all([
      query<
        Interview & {
          candidate_name: string;
          candidate_email: string;
          job_title: string;
          application_stage: Stage;
        }
      >(
        `SELECT i.*,
                c.full_name AS candidate_name,
                c.email AS candidate_email,
                j.title AS job_title,
                a.stage AS application_stage
         FROM HRSYSTEM_interviews i
         JOIN HRSYSTEM_applications a ON a.id = i.application_id
         JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
         JOIN HRSYSTEM_jobs j ON j.id = a.job_id
         WHERE i.status = 'SCHEDULED'
           AND i.scheduled_at >= now()
           AND i.scheduled_at < now() + interval '14 days'
         ORDER BY i.scheduled_at ASC`,
      ),
      query<{
        application_id: string;
        candidate_name: string;
        candidate_email: string;
        job_title: string;
        stage: Stage;
        updated_at: string;
      }>(
        `SELECT a.id AS application_id,
                c.full_name AS candidate_name,
                c.email AS candidate_email,
                j.title AS job_title,
                a.stage,
                a.updated_at
         FROM HRSYSTEM_applications a
         JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
         JOIN HRSYSTEM_jobs j ON j.id = a.job_id
         WHERE a.stage IN ('FINAL_INTERVIEW_PENDING', 'SECOND_FINAL_INTERVIEW')
           AND a.status = 'ACTIVE'
         ORDER BY a.updated_at DESC`,
      ),
    ]);

    const data: HrInterviewsListResult = { upcoming, awaiting };
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load interviews');
  }
}
