'use client';

import { useState } from 'react';
import { Alert, Group, Paper, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { HrFinalDecisionResult, HrFinalDecisionValue } from '@/types/api';

const DECISIONS: Array<{ value: HrFinalDecisionValue; label: string; color?: string }> = [
  { value: 'HIRED', label: 'Hired', color: 'success' },
  { value: 'OFFER_PENDING', label: 'Offer pending', color: 'accent' },
  { value: 'SECOND_FINAL_INTERVIEW', label: 'Second interview', color: 'warning' },
  { value: 'HOLD', label: 'Hold', color: 'warning' },
  { value: 'FINAL_REJECTED', label: 'Reject', color: 'danger' },
];

export function FinalDecisionBar({
  applicationId,
  candidateName,
  onDecided,
}: {
  applicationId: string;
  candidateName: string;
  onDecided: () => void;
}) {
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState<HrFinalDecisionValue | null>(null);

  async function submit(decision: HrFinalDecisionValue) {
    if (decision === 'HIRED') {
      const ok =
        confirm.trim().toUpperCase() === 'HIRED' ||
        confirm.trim().toLowerCase() === candidateName.trim().toLowerCase();
      if (!ok) {
        toastError(`Type HIRED or "${candidateName}" to confirm hiring.`);
        return;
      }
    }

    setSubmitting(decision);
    try {
      await api<HrFinalDecisionResult>(`/api/hr/candidates/${applicationId}/final-decision`, {
        method: 'POST',
        body: { decision, note: note || undefined, confirm: confirm || undefined },
      });
      toastSuccess(`Final decision: ${decision}`);
      setNote('');
      setConfirm('');
      onDecided();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setSubmitting(null);
    }
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
      }}
    >
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          Final decision
        </Text>
        <Alert color="warning" variant="light">
          Hired emails the candidate. Type <strong>HIRED</strong> or their full name to confirm.
        </Alert>
        <Textarea
          className="rounded outline-none"
          label="Note"
          aria-label="Final decision note"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          minRows={2}
        />
        <TextInput
          className="rounded outline-none"
          label="Confirm hire"
          aria-label="Type HIRED or candidate name to confirm"
          placeholder={`HIRED or ${candidateName}`}
          value={confirm}
          onChange={(e) => setConfirm(e.currentTarget.value)}
        />
        <Group gap="sm">
          {DECISIONS.map((d) => (
            <MotionButton
              key={d.value}
              className="cursor-pointer rounded-lg"
              aria-label={d.label}
              color={d.color}
              variant={d.value === 'HIRED' ? 'filled' : 'default'}
              loading={submitting === d.value}
              disabled={submitting !== null}
              onClick={() => void submit(d.value)}
            >
              {d.label}
            </MotionButton>
          ))}
        </Group>
      </Stack>
    </Paper>
  );
}
