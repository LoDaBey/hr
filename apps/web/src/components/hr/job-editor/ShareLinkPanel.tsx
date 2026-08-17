'use client';

import { Group, Paper, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { MotionButton } from '@/components/MotionButton';
import { density, palette } from '@/theme';

export function ShareLinkPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

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
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{ borderColor: palette.accent }}
    >
      <Title order={4} mb="xs">
        Share this link with candidates
      </Title>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text style={{ wordBreak: 'break-all', color: palette.ink }} ff="monospace" size="sm">
          {url}
        </Text>
        <Group gap="xs">
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Copy public job link"
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied' : 'Copy link'}
          </MotionButton>
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Open public job page"
            variant="subtle"
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open
          </MotionButton>
        </Group>
      </Group>
    </Paper>
  );
}
