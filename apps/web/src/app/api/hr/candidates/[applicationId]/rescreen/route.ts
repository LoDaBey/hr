import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { runCvParseAndScreening } from '@/lib/pipeline/screening';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  const { applicationId } = await context.params;

  // Fire-and-forget; the UI will mutate after a short delay.
  void runCvParseAndScreening(applicationId).catch((err) => {
    console.error('rescreen failed', applicationId, err);
  });

  return jsonOk({ queued: true });
}
