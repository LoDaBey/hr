'use client';

import { useState } from 'react';
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { publicJobUrl } from '@/lib/public-job-url';
import { density } from '@/theme';
import type { JobStatus } from '@/types/domain';

export function JobLinkCell({ status, slug }: { status: JobStatus; slug: string }) {
  const [copied, setCopied] = useState(false);

  if (status !== 'OPEN') {
    return (
      <Text size="sm" c="dimmed">
        Not published — no public link yet
      </Text>
    );
  }

  const url = publicJobUrl(slug);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" style={{ maxWidth: 180 }} truncate title={url}>
        {url}
      </Text>
      <Tooltip label={copied ? 'Copied' : 'Copy link'}>
        <motion.div
          whileHover={{ scale: density.motion.hoverScale }}
          whileTap={{ scale: density.motion.tapScale }}
        >
          <ActionIcon
            className="cursor-pointer rounded-lg"
            aria-label={copied ? 'Link copied' : `Copy public link for ${slug}`}
            variant="subtle"
            onClick={() => void handleCopy()}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </motion.div>
      </Tooltip>
    </Group>
  );
}
