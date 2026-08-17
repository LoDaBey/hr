import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { AppShell } from '@/components/AppShell';

export default async function HrLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    return children;
  }

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? 'HR'}
      userRole={session.user.role ?? ''}
    >
      {children}
    </AppShell>
  );
}
