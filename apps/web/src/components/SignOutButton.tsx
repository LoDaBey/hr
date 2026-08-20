'use client';

import { signOut } from 'next-auth/react';
import { MotionButton } from '@/components/MotionButton';

export function SignOutButton() {
  return (
    <MotionButton
      className="cursor-pointer rounded-lg"
      aria-label="Sign out"
      variant="default"
      size="compact-sm"
      onClick={() => signOut({ callbackUrl: '/hr/login' })}
    >
      Sign out
    </MotionButton>
  );
}
