import 'server-only';
import { one, query } from '@/lib/db';
import type { HrDashboardResult, HrDashboardTotals } from '@/types/api';

type JobCountRow = {
  job_id: string;
  title: string;
  applied: number;
  screening: number;
  assessment: number;
  recorded: number;
  final_int: number;
  hired: number;
  rejected: number;
};

type TotalsRow = {
  applicants: number;
  new_today: number;
  awaiting_review: number;
  assessments_pending: number;
  assessments_completed: number;
  techtests_pending: number;
  interviews_upcoming: number;
  hired: number;
  rejected: number;
};

type AlertCounts = {
  failed_emails: number;
  open_errors: number;
};

export async function getHrDashboard(): Promise<HrDashboardResult> {
  const [byJobRows, totalsRow, alerts] = await Promise.all([
    query<JobCountRow>(
      `SELECT j.id AS job_id, j.title,
         count(*) FILTER (WHERE a.stage='APPLICATION_RECEIVED') AS applied,
         count(*) FILTER (WHERE a.stage IN ('CV_PROCESSING','INITIAL_SCREENING',
                                            'INITIAL_SCREENING_REVIEW')) AS screening,
         count(*) FILTER (WHERE a.stage::text LIKE 'TECH_ASSESSMENT%') AS assessment,
         count(*) FILTER (WHERE a.stage::text LIKE 'RECORDED_TECH%') AS recorded,
         count(*) FILTER (WHERE a.stage::text LIKE 'FINAL_INTERVIEW%' OR a.stage='OFFER_PENDING') AS final_int,
         count(*) FILTER (WHERE a.stage='HIRED') AS hired,
         count(*) FILTER (WHERE a.status='REJECTED') AS rejected
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.status <> 'DRAFT'
       GROUP BY j.id, j.title
       ORDER BY j.created_at DESC`,
    ),
    one<TotalsRow>(
      `SELECT
         count(*)::int AS applicants,
         count(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS new_today,
         count(*) FILTER (WHERE stage = 'INITIAL_SCREENING_REVIEW' AND status = 'ACTIVE')::int
           AS awaiting_review,
         count(*) FILTER (
           WHERE stage IN ('TECH_ASSESSMENT_SENT','TECH_ASSESSMENT_STARTED') AND status = 'ACTIVE'
         )::int AS assessments_pending,
         count(*) FILTER (WHERE stage = 'TECH_ASSESSMENT_REVIEW')::int AS assessments_completed,
         count(*) FILTER (
           WHERE stage IN ('RECORDED_TECH_INVITED','RECORDED_TECH_STARTED') AND status = 'ACTIVE'
         )::int AS techtests_pending,
         count(*) FILTER (
           WHERE stage IN ('FINAL_INTERVIEW_PENDING','FINAL_INTERVIEW_SCHEDULED')
         )::int AS interviews_upcoming,
         count(*) FILTER (WHERE stage = 'HIRED')::int AS hired,
         count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected
       FROM applications`,
    ),
    one<AlertCounts>(
      `SELECT
         (SELECT count(*)::int FROM communications WHERE status = 'FAILED') AS failed_emails,
         (SELECT count(*)::int FROM workflow_errors WHERE resolved = false) AS open_errors`,
    ),
  ]);

  const totals: HrDashboardTotals = {
    applicants: totalsRow?.applicants ?? 0,
    new_today: totalsRow?.new_today ?? 0,
    awaiting_review: totalsRow?.awaiting_review ?? 0,
    assessments_pending: totalsRow?.assessments_pending ?? 0,
    assessments_completed: totalsRow?.assessments_completed ?? 0,
    techtests_pending: totalsRow?.techtests_pending ?? 0,
    interviews_upcoming: totalsRow?.interviews_upcoming ?? 0,
    hired: totalsRow?.hired ?? 0,
    rejected: totalsRow?.rejected ?? 0,
    failed_emails: alerts?.failed_emails ?? 0,
    open_errors: alerts?.open_errors ?? 0,
  };

  return {
    totals,
    by_job: byJobRows.map((row) => ({
      job_id: row.job_id,
      title: row.title,
      counts: {
        applied: Number(row.applied) || 0,
        screening: Number(row.screening) || 0,
        assessment: Number(row.assessment) || 0,
        recorded: Number(row.recorded) || 0,
        final_int: Number(row.final_int) || 0,
        hired: Number(row.hired) || 0,
        rejected: Number(row.rejected) || 0,
      },
    })),
  };
}
