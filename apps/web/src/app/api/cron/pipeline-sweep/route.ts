import { runPipelineSweep } from '@/lib/pipeline/sweep';
import { jsonError, jsonOk } from '@/lib/http';

export const dynamic = 'force-dynamic';
// maxDuration: keep in sync with ROUTE_BUDGET_SECONDS in src/lib/automation.ts
export const maxDuration = 60;

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('Missing env var: CRON_SECRET');
    return false;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return jsonError(401, 'UNAUTHENTICATED', 'Invalid cron secret');
  }

  try {
    return jsonOk(await runPipelineSweep());
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Pipeline sweep failed');
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
