'use client';

import { Button } from '@mantine/core';
import { motion } from 'framer-motion';
import { density } from '@/theme';

/** Mantine Button with Framer Motion hover/tap. Props match Mantine Button (polymorphic). */
export function MotionButton(props: React.ComponentProps<typeof Button> & Record<string, unknown>) {
  const { style, ...rest } = props;

  return (
    <motion.div
      layout
      whileHover={{ scale: density.motion.hoverScale }}
      whileTap={{ scale: density.motion.tapScale }}
      transition={{ duration: density.motion.durationFast }}
      style={{
        display: 'inline-flex',
        ...(style && typeof style === 'object' ? (style as React.CSSProperties) : {}),
      }}
    >
      <Button {...(rest as React.ComponentProps<typeof Button>)} />
    </motion.div>
  );
}
