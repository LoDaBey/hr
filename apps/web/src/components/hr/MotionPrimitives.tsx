'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  fadeUpVariants,
  listContainerVariants,
  listItemVariants,
  motionTransition,
} from '@/lib/motion';

export function MotionPage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={fadeUpVariants}
      initial="initial"
      animate="animate"
      transition={motionTransition}
    >
      {children}
    </motion.div>
  );
}

export function MotionStagger({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={listContainerVariants} initial="initial" animate="animate">
      {children}
    </motion.div>
  );
}

export function MotionItem({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={listItemVariants} transition={motionTransition}>
      {children}
    </motion.div>
  );
}
