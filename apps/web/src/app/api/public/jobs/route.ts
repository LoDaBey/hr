// No public job index endpoint. Listing every OPEN job would let anyone
// enumerate roles that are only meant to be reachable via the slug link HR sends.
// Job detail lives at /api/public/jobs/[slug].
export function GET() {
  return Response.json(
    { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
    { status: 404 },
  );
}
