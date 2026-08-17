import 'server-only';
import { auth } from '@/auth';

export type HrUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/** Session check for every HR route handler. Middleware only redirects. */
export async function requireHr(): Promise<HrUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role;
  if (role !== 'HR' && role !== 'ADMIN') return null;
  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role,
  };
}
