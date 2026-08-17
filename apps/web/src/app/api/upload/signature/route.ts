import { z } from 'zod';
import type { CloudinarySignatureResult, ErrorCode } from '@/types/api';
import { signUpload } from '@/lib/cloudinary';
import { one } from '@/lib/db';
import { isRateLimited } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';

const bodySchema = z.object({
  kind: z.enum(['cv', 'video']),
  token: z.string().min(1).optional(),
});

function jsonError(status: number, code: ErrorCode, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function hasActiveTechTest(token: string): Promise<boolean> {
  const row = await one<{ sitting_id: string }>(
    `SELECT ca.id AS sitting_id
     FROM access_tokens t
     JOIN candidate_assessments ca ON ca.id = t.candidate_assessment_id
     WHERE t.token_hash = $1
       AND (t.expires_at IS NULL OR t.expires_at > now())
       AND ca.kind = 'TECH_TEST'
       AND (
         (t.used_at IS NULL AND ca.status IN ('INVITED', 'STARTED'))
         OR (ca.status = 'SUBMITTED' AND ca.recording_status = 'UPLOAD_PENDING')
       )
     LIMIT 1`,
    [hashToken(token)],
  );
  return Boolean(row?.sitting_id);
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'VALIDATION_FAILED', 'Invalid JSON body');
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION_FAILED', 'kind must be cv or video');
  }

  const { kind, token } = parsed.data;

  try {
    if (kind === 'cv') {
      const limited = await isRateLimited(`cloudinary-sig:${clientIp(req)}`, 20, 60);
      if (limited) {
        return jsonError(429, 'RATE_LIMITED', 'Too many signature requests');
      }
    } else {
      if (!token) {
        return jsonError(401, 'TOKEN_INVALID', 'No active tech-test session');
      }
      const tokenOk = await hasActiveTechTest(token);
      if (!tokenOk) {
        return jsonError(401, 'TOKEN_INVALID', 'No active tech-test session');
      }
    }

    const data: CloudinarySignatureResult = signUpload(kind);
    return Response.json({ ok: true, data });
  } catch {
    return jsonError(500, 'INTERNAL_ERROR', 'Upload signing unavailable');
  }
}
