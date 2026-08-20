import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { listFailedCommunications } from '@/lib/repos/communications';
import {
  listStuckGradings,
  listStuckScreenings,
  listWorkflowErrors,
} from '@/lib/repos/workflow-errors';
import type { HrErrorsListResult } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const url = new URL(req.url);
    const resolvedParam = url.searchParams.get('resolved');
    const resolved = resolvedParam === 'true';
    const limitRaw = Number(url.searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 50;

    const [errors, failed_emails, stuck_gradings, stuck_screenings] = await Promise.all([
      listWorkflowErrors({ resolved, limit }),
      listFailedCommunications(limit),
      listStuckGradings(limit),
      listStuckScreenings(limit),
    ]);

    const data: HrErrorsListResult = {
      errors,
      failed_emails,
      stuck_gradings,
      stuck_screenings,
    };
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load errors');
  }
}
