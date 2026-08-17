import 'server-only';
import { one } from '@/lib/db';

export async function hitRateLimit(bucket: string, windowSeconds: number): Promise<number> {
  const row = await one<{ hits: number }>(
    `INSERT INTO rate_limits(bucket, window_start, hits)
     VALUES (
       $1,
       to_timestamp(floor(extract(epoch from now()) / $2::double precision) * $2::double precision),
       1
     )
     ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits`,
    [bucket, windowSeconds],
  );
  return row?.hits ?? 1;
}

export async function isRateLimited(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const hits = await hitRateLimit(bucket, windowSeconds);
  return hits > limit;
}
