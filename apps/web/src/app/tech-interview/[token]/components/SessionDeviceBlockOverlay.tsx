'use client';

import { Stack, Text, Title } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { palette } from '@/theme';

export function SessionDeviceBlockOverlay({
  message,
  restoring,
  onResume,
}: {
  message: string;
  restoring?: boolean;
  onResume: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Recording paused"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: `${palette.ink}cc`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Stack
        gap="md"
        maw={420}
        p="xl"
        style={{
          background: palette.paper,
          borderRadius: 12,
          border: `1px solid ${palette.warning}55`,
        }}
      >
        <Title order={3} style={{ color: palette.ink }}>
          Recording stopped
        </Title>
        <Text style={{ color: palette.ink }}>{message}</Text>
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Resume session after restoring devices"
          color="accent"
          loading={restoring}
          fullWidth
          onClick={() => void onResume()}
        >
          Resume
        </MotionButton>
      </Stack>
    </div>
  );
}
