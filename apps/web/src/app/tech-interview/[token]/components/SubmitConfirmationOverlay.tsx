'use client';

import { Group, Stack, Text, Title } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { palette } from '@/theme';

export function SubmitConfirmationOverlay({
  open,
  submitting,
  unansweredCount,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  submitting?: boolean;
  unansweredCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm submission"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 180,
        background: `${palette.ink}dd`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Stack
        gap="lg"
        maw={480}
        w="100%"
        p="xl"
        style={{
          background: palette.paper,
          borderRadius: 12,
          border: `1px solid ${palette.ink}14`,
        }}
      >
        <Title order={2} style={{ color: palette.ink }}>
          Submit your answers?
        </Title>
        <Text style={{ color: palette.ink }}>
          {unansweredCount === 0
            ? 'All questions have an answer. Submitting will stop the recording and upload your session.'
            : `${unansweredCount} question${unansweredCount === 1 ? '' : 's'} still blank. You can still submit.`}
        </Text>
        {submitting ? (
          <Text size="sm" c="dimmed" aria-live="polite">
            Submitting — please keep this tab open…
          </Text>
        ) : null}
        <Group justify="flex-end" gap="sm">
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Cancel submit"
            variant="default"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </MotionButton>
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Confirm submit"
            color="accent"
            loading={submitting}
            onClick={onConfirm}
          >
            Submit now
          </MotionButton>
        </Group>
      </Stack>
    </div>
  );
}
