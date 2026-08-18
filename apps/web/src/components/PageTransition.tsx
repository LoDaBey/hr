'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { motionTransition, pageVariants } from '@/lib/motion';

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={motionTransition}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}
