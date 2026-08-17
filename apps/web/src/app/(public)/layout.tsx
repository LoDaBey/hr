import type { ReactNode } from 'react';
import { PublicHeader } from './components/PublicHeader';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
