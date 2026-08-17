import { jsonError, jsonOk, publicJobStatus } from '@/lib/http';
import { getPublicJob } from '@/lib/repos/jobs';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const result = await getPublicJob(slug);
  if (!result.ok) {
    return jsonError(publicJobStatus(result.code), result.code, result.message);
  }
  return jsonOk({ job: result.job, questions: result.questions });
}
