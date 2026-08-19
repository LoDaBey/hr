import { requireHr } from '@/lib/auth-hr';
import { signedDeliveryUrl } from '@/lib/cloudinary';
import { one } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Mint a fresh signed CV URL and redirect — avoids exposing expiry to HR. */
export async function GET(
  _req: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const user = await requireHr();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { applicationId } = await context.params;
  const doc = await one<{
    public_id: string;
    resource_type: string;
    format: string | null;
  }>(
    `SELECT public_id, resource_type, format
     FROM HRSYSTEM_documents
     WHERE application_id = $1 AND doc_type = 'CV'
     ORDER BY created_at DESC
     LIMIT 1`,
    [applicationId],
  );

  if (!doc) {
    return NextResponse.json({ error: 'CV not found' }, { status: 404 });
  }

  const format = doc.format || 'pdf';
  const signed = signedDeliveryUrl(doc.public_id, doc.resource_type, format);
  return NextResponse.redirect(signed.url);
}
