import { requireHr } from '@/lib/auth-hr';
import { errorCode, errorMessage } from '@/lib/errors';
import { jsonError, jsonOk } from '@/lib/http';
import { getHrJobDetail, updateHrJob } from '@/lib/repos/hr-jobs';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const { jobId } = await context.params;
    const data = await getHrJobDetail(jobId);
    if (!data) {
      return jsonError(404, 'NOT_FOUND', 'Job not found');
    }
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load job');
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return jsonError(400, 'VALIDATION_FAILED', 'Expected an object body');
  }

  try {
    const { jobId } = await context.params;
    const data = await updateHrJob(jobId, raw as Record<string, unknown>, {
      id: user.id,
      name: user.name,
    });
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    const code = errorCode(error);
    if (code === 'NOT_FOUND') {
      return jsonError(404, 'NOT_FOUND', errorMessage(error, 'Job not found'));
    }
    if (code === 'VALIDATION_FAILED') {
      return jsonError(400, 'VALIDATION_FAILED', errorMessage(error, 'Validation failed'));
    }
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to update job');
  }
}
