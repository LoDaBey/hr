'use client';

import { Group, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { MotionButton } from '@/components/MotionButton';
import { SectionCard } from '@/components/ui/SectionCard';
import { palette } from '@/theme';

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
    <SectionCard
      title="Share with candidates"
      description="Anyone with this link can open the public application page."
      compact
    >
      <Group gap="sm" wrap="wrap" align="flex-end">
        <TextInput
          className="rounded outline-none"
          aria-label="Public job application link"
          readOnly
          value={url}
          style={{ flex: 1, minWidth: 200 }}
          styles={{
            input: {
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              color: palette.ink,
              background: palette.paper,
            },
          }}
        />
        <Group gap="xs">
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Copy public job link"
            onClick={() => void handleCopy()}
            size="sm"
          >
            {copied ? 'Copied' : 'Copy link'}
          </MotionButton>
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Open public job page"
            variant="default"
            size="sm"
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open
          </MotionButton>
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mt={4} hidden>
        {url}
      </Text>
    </SectionCard>
  );
}
