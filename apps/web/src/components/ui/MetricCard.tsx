'use client';

import Link from 'next/link';
import { Box, Text } from '@mantine/core';
import { motion } from 'framer-motion';
import type { MetricCardProps, StatusTone } from '@/types/ui';
import { density, palette, shadows } from '@/theme';

const TONE_ACCENT: Record<StatusTone, string> = {
  accent: palette.accent,
  success: palette.success,
  danger: palette.danger,
  warning: palette.warning,
  ink: palette.ink,
  muted: palette.muted,
};

export function MetricCard({
  label,
  value,
  href,
  emphasis = 'default',
  tone = 'accent',
}: MetricCardProps) {
  const isPrimary = emphasis === 'primary';
  const isMuted = emphasis === 'muted';
  const accent = TONE_ACCENT[tone];

  const content = (
    <Box
      p="md"
      style={{
        background: palette.surface,
        border: `1px solid ${isPrimary ? `${accent}55` : palette.border}`,
        borderRadius: 8,
        boxShadow: isPrimary ? shadows.sm : undefined,
        borderLeft: isPrimary ? `3px solid ${accent}` : undefined,
        height: '100%',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      }}
    >
      <Text
        size="xs"
        fw={600}
        tt="uppercase"
        style={{
          letterSpacing: '0.04em',
          color: isMuted ? palette.muted : isPrimary ? accent : palette.muted,
        }}
      >
        {label}
      </Text>
      <Text
        fw={700}
        mt={6}
        style={{
          fontSize: isPrimary ? '1.75rem' : '1.5rem',
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: isMuted ? palette.muted : palette.ink,
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
    </Box>
  );

  if (!href) return content;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: density.motion.tapScale }}
      transition={{ duration: density.motion.durationFast }}
      style={{ height: '100%' }}
    >
      <Link
        href={href}
        aria-label={`View ${label}: ${value}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
      >
        {content}
      </Link>
    </motion.div>
  );
}
