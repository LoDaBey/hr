import { requireHr } from '@/lib/auth-hr';
import { jsonError, jsonOk } from '@/lib/http';
import { listHrCandidates } from '@/lib/repos/hr-candidates';
import type { Stage, Status } from '@/types/domain';

export const dynamic = 'force-dynamic';

function nullIfEmpty(value: string | null): string | null {
  if (value == null || value.trim() === '') return null;
  return value;
}

function parseIntOrNull(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseNumberOrNull(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const user = await requireHr();
  if (!user) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in required');
  }

  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('page_size') ?? '20') || 20),
    );

    const data = await listHrCandidates({
      job_id: nullIfEmpty(url.searchParams.get('job_id')),
      stage: nullIfEmpty(url.searchParams.get('stage')) as Stage | null,
      status: nullIfEmpty(url.searchParams.get('status')) as Status | null,
      min_score: parseIntOrNull(url.searchParams.get('min_score')),
      min_experience: parseNumberOrNull(url.searchParams.get('min_experience')),
      q: nullIfEmpty(url.searchParams.get('q')),
      page,
      page_size: pageSize,
    });

    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to list candidates');
  }
}
