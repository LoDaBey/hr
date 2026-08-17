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
    `INSERT INTO workflow_errors (
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
     FROM workflow_errors
     WHERE resolved = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [opts.resolved, opts.limit],
  );
}
