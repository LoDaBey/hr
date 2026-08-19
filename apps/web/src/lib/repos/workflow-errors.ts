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
