import { requireHr } from '@/lib/auth-hr';
import { errorCode, errorMessage } from '@/lib/errors';
import { jsonError, jsonOk } from '@/lib/http';
import { deleteHrCandidateApplication, getHrCandidateDetail } from '@/lib/repos/hr-candidates';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const { applicationId } = await context.params;
    const data = await getHrCandidateDetail(applicationId);
    if (!data) {
      return jsonError(404, 'NOT_FOUND', 'Application not found');
    }
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load candidate');
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const { applicationId } = await context.params;
    const data = await deleteHrCandidateApplication(applicationId);
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    const code = errorCode(error);
    if (code === 'NOT_FOUND') {
      return jsonError(404, 'NOT_FOUND', errorMessage(error, 'Application not found'));
    }
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to delete candidate');
  }
}
