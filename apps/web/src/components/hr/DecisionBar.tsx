'use client';

import { useState } from 'react';
import { Alert, Group, Paper, Stack, Textarea, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { ApiError, api } from '@/lib/api';
import { DECISIONS_BY_STAGE, HR_DECISION } from '@/lib/labels';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { HrDecisionResult, HrDecisionValue } from '@/types/api';
import type { Stage } from '@/types/domain';

function decisionColor(decision: HrDecisionValue): string | undefined {
  if (decision === 'REJECT' || decision === 'WITHDRAW') return 'danger';
  if (decision === 'SHORTLIST') return 'success';
  if (decision === 'HOLD' || decision === 'REQUEST_INFO') return 'warning';
  return undefined;
}

export function DecisionBar({
  applicationId,
  stage,
  onDecided,
}: {
  applicationId: string;
  stage: Stage;
  onDecided: () => void;
}) {
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState<HrDecisionValue | null>(null);
  const [stale, setStale] = useState(false);

  const allowed = DECISIONS_BY_STAGE[stage] ?? [];

  async function submit(decision: HrDecisionValue) {
    setSubmitting(decision);
    setStale(false);
    try {
      await api<HrDecisionResult>(`/api/hr/candidates/${applicationId}/decision`, {
        method: 'POST',
        body: {
          decision,
          note: note || null,
          reason: reason || note || null,
          expected_stage: stage,
        },
      });
      toastSuccess(`Decision recorded: ${HR_DECISION[decision]}`);
      setNote('');
      setReason('');
      onDecided();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'WRONG_STAGE') {
        setStale(true);
        onDecided();
      } else {
        toastError(error instanceof Error ? error.message : 'Decision failed');
      }
    } finally {
      setSubmitting(null);
    }
  }

  if (allowed.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No HR decisions available at this stage.
      </Text>
    );
  }

  return (
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: palette.paper,
        borderColor: `${palette.ink}22`,
        boxShadow: `0 ${density.stageRail.sm.gap}px ${density.stageRail.lg.height}px ${palette.ink}10`,
      }}
    >
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          Decision
        </Text>
        {stale ? (
          <Alert color="warning" title="Updated elsewhere">
            This candidate was updated by someone else. Refreshing…
          </Alert>
        ) : null}
        <Group grow align="flex-start">
          <Textarea
            className="rounded outline-none"
            label="Note"
            aria-label="Decision note"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            className="rounded outline-none"
            label="Reason (reject / hold)"
            aria-label="Decision reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            minRows={2}
          />
        </Group>
        <Group gap="sm">
          {allowed.map((decision) => {
            const isPrimary = decision === 'SHORTLIST';
            return (
              <MotionButton
                key={decision}
                className="cursor-pointer rounded-lg"
                aria-label={HR_DECISION[decision]}
                color={decisionColor(decision)}
                variant={isPrimary ? 'filled' : 'default'}
                loading={submitting === decision}
                disabled={submitting !== null}
                onClick={() => void submit(decision)}
              >
                {HR_DECISION[decision]}
              </MotionButton>
            );
          })}
        </Group>
      </Stack>
    </Paper>
  );
}
