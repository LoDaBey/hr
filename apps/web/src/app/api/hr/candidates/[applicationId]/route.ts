import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { getHrCandidateDetail } from '@/lib/repos/hr-candidates';

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
