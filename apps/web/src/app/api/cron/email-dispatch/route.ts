import { dispatchPendingEmails } from '@/lib/email-dispatch';
import { jsonError, jsonOk } from '@/lib/http';

export const dynamic = 'force-dynamic';

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('Missing env var: CRON_SECRET');
    return false;
  }
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return jsonError(401, 'UNAUTHENTICATED', 'Invalid cron secret');
  }

  try {
    const result = await dispatchPendingEmails(20);
    return jsonOk(result);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Email dispatch failed');
  }
}

/** Vercel Cron hits GET with Authorization: Bearer $CRON_SECRET */
export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

/** Local /hr/errors "Send queued emails" button posts to the same handler */
export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
