import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { getHrDashboard } from '@/lib/repos/hr-dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const data = await getHrDashboard();
    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load dashboard');
  }
}
