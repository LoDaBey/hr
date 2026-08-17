/** Public candidate apply URL for a job slug. */
export function publicJobUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return `${base}/jobs/${slug}`;
}
