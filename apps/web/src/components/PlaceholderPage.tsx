'use client';

import { Stack, Text, Title } from '@mantine/core';
import { motion } from 'framer-motion';
import { fadeUpVariants, motionTransition } from '@/lib/motion';

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={fadeUpVariants}
      initial="initial"
      animate="animate"
      transition={motionTransition}
    >
      <Stack gap="sm">
        <Title order={1}>{title}</Title>
        <Text c="dimmed">{description}</Text>
      </Stack>
    </motion.div>
  );
}
