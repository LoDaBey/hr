import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const hasDiscrete = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
  if (!hasUrl && !hasDiscrete) {
    console.error('Missing env var: DATABASE_URL');
    return Response.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Missing env var: DATABASE_URL' } },
      { status: 502 },
    );
  }

  try {
    const row = await one<{ now: string }>(`SELECT now()`);
    return Response.json({ ok: true, data: { now: row?.now ?? null } });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } },
      { status: 502 },
    );
  }
}
