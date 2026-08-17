import type { ApiErrorBody, ErrorCode } from '@/types/api';

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function jsonError(
  status: number,
  code: ErrorCode,
  message: string,
  extra?: { fields?: string[] },
): Response {
  const error: ApiErrorBody = extra?.fields?.length
    ? { code, message, fields: extra.fields }
    : { code, message };
  return Response.json({ ok: false, error }, { status });
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function publicJobStatus(code: 'NOT_FOUND' | 'JOB_CLOSED' | 'DEADLINE_PASSED'): number {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'JOB_CLOSED') return 409;
  return 400;
}
