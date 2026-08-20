import 'server-only';
import { one, query } from '@/lib/db';
import type { WorkflowError } from '@/types/domain';

export async function insertWorkflowError(input: {
  action: string;
  node: string;
  error_message: string;
  application_id?: string | null;
  candidate_id?: string | null;
  input_ref?: unknown;
}): Promise<WorkflowError | null> {
  return one<WorkflowError>(
    `INSERT INTO HRSYSTEM_workflow_errors (
       action, node, error_message, application_id, candidate_id, input_ref
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [
      input.action,
      input.node,
      input.error_message,
      input.application_id ?? null,
      input.candidate_id ?? null,
      JSON.stringify(input.input_ref ?? {}),
    ],
  );
}

export async function resolveGradingErrorsForSitting(
  applicationId: string,
  sittingId: string,
): Promise<number> {
  const rows = await query<{ id: number }>(
    `UPDATE HRSYSTEM_workflow_errors
     SET resolved = true
     WHERE application_id = $1
       AND action = 'assessment.grade'
       AND resolved = false
       AND input_ref->>'candidate_assessment_id' = $2
     RETURNING id`,
    [applicationId, sittingId],
  );
  return rows.length;
}

export async function findGradingErrorForSitting(
  applicationId: string,
  sittingId: string,
): Promise<string | null> {
  const row = await one<{ error_message: string | null }>(
    `SELECT error_message
     FROM HRSYSTEM_workflow_errors
     WHERE application_id = $1
       AND action = 'assessment.grade'
       AND resolved = false
       AND input_ref->>'candidate_assessment_id' = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [applicationId, sittingId],
  );
  return row?.error_message ?? null;
}

export async function listWorkflowErrors(opts: {
  resolved: boolean;
  limit: number;
}): Promise<
  Array<{
    id: number;
    action: string | null;
    node: string | null;
    error_message: string | null;
    created_at: string;
    resolved: boolean;
  }>
> {
  return query(
    `SELECT id, action, node, error_message, created_at, resolved
     FROM HRSYSTEM_workflow_errors
     WHERE resolved = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [opts.resolved, opts.limit],
  );
}

export async function listStuckGradings(limit: number): Promise<
  Array<{
    application_id: string;
    candidate_assessment_id: string;
    kind: 'ASSESSMENT' | 'TECH_TEST';
    stage: string;
    submitted_at: string;
    grading_attempts: number;
    grading_claimed_at: string | null;
    last_error: string | null;
    candidate_name: string | null;
  }>
> {
  return query(
    `SELECT
       a.id AS application_id,
       ca.id AS candidate_assessment_id,
       ca.kind,
       a.stage,
       ca.submitted_at,
       ca.grading_attempts,
       ca.grading_claimed_at,
       c.full_name AS candidate_name,
       (
         SELECT we.error_message
         FROM HRSYSTEM_workflow_errors we
         WHERE we.application_id = a.id
           AND we.action = 'assessment.grade'
           AND we.resolved = false
           AND we.input_ref->>'candidate_assessment_id' = ca.id::text
         ORDER BY we.created_at DESC
         LIMIT 1
       ) AS last_error
     FROM HRSYSTEM_candidate_assessments ca
     JOIN HRSYSTEM_applications a ON a.id = ca.application_id
     JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
     WHERE ca.status = 'SUBMITTED'
       AND ca.kind IN ('ASSESSMENT', 'TECH_TEST')
       AND a.stage IN ('TECH_ASSESSMENT_SUBMITTED', 'RECORDED_TECH_SUBMITTED')
       AND ca.submitted_at < now() - interval '30 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM HRSYSTEM_assessment_evaluations ae
         WHERE ae.candidate_assessment_id = ca.id
           AND ae.is_overall = true
           AND ae.score IS NOT NULL
           AND (ae.raw_response IS NULL OR ae.raw_response->>'grading_failed' IS DISTINCT FROM 'true')
       )
     ORDER BY ca.submitted_at ASC
     LIMIT $1`,
    [limit],
  );
}

export async function listStuckScreenings(limit: number): Promise<
  Array<{
    application_id: string;
    candidate_name: string | null;
    stage: string;
    created_at: string;
    screening_attempts: number;
    screening_claimed_at: string | null;
    last_error: string | null;
  }>
> {
  return query(
    `SELECT
       a.id AS application_id,
       c.full_name AS candidate_name,
       a.stage,
       a.created_at,
       a.screening_attempts,
       a.screening_claimed_at,
       (
         SELECT we.error_message
         FROM HRSYSTEM_workflow_errors we
         WHERE we.application_id = a.id
           AND we.action = 'screening.run'
           AND we.resolved = false
         ORDER BY we.created_at DESC
         LIMIT 1
       ) AS last_error
     FROM HRSYSTEM_applications a
     JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
     WHERE a.stage IN ('APPLICATION_RECEIVED', 'CV_PROCESSING')
       AND a.created_at < now() - interval '30 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM HRSYSTEM_screening_results sr WHERE sr.application_id = a.id
       )
     ORDER BY a.created_at ASC
     LIMIT $1`,
    [limit],
  );
}
