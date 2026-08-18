'use client';

import { useState } from 'react';
import { Alert, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { ApiError, api } from '@/lib/api';
import { datetime } from '@/lib/format';
import { SITTING_STATUS, labelOf } from '@/lib/labels';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { HrInviteResult } from '@/types/api';
import type { Communication, RecordingStatus, SittingStatus, Stage } from '@/types/domain';

const INVITE_STAGES: Stage[] = [
  'TECH_SHORTLISTED',
  'RECORDED_TECH_INVITED',
  'RECORDED_TECH_STARTED',
];

export type TechTestInviteSummary = {
  id: string;
  status: SittingStatus;
  invite_deadline: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  late: boolean;
  ai_score: number | null;
  recording_status: RecordingStatus | null;
};

function findPendingInvite(
  communications: Communication[],
  sittingId: string | undefined,
): Communication | null {
  if (!sittingId) return null;
  const pending = HRSYSTEM_communications.find(
    (c) =>
      c.template_key === 'TECHTEST_INVITE' &&
      c.status === 'PENDING' &&
      c.dedupe_key.includes(sittingId),
  );
  if (!pending) return null;
  if (new Date(pending.scheduled_for).getTime() <= Date.now()) return null;
  return pending;
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
}

export function TechTestInviteBar({
  applicationId,
  stage,
  techtest,
  communications = [],
  jobHasTechTest = true,
  autoInviteSkipped = false,
  onInvited,
}: {
  applicationId: string;
  stage: Stage;
  techtest: TechTestInviteSummary | null;
  communications?: Communication[];
  jobHasTechTest?: boolean;
  autoInviteSkipped?: boolean;
  onInvited: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);

  if (!INVITE_STAGES.includes(stage)) {
    return null;
  }

  const pending = findPendingInvite(communications, techtest?.id);
  const canResend =
    !pending &&
    techtest != null &&
    (techtest.status === 'INVITED' || techtest.status === 'STARTED');
  const showSend = stage === 'TECH_SHORTLISTED' && !canResend && !pending;
  const showMissingHint =
    stage === 'TECH_SHORTLISTED' && (!jobHasTechTest || autoInviteSkipped) && !techtest;

  async function invite() {
    setSubmitting(true);
    setStale(false);
    try {
      await api<HrInviteResult>(`/api/hr/candidates/${applicationId}/techtest/invite`, {
        method: 'POST',
      });
      toastSuccess(
        canResend
          ? 'Recorded tech test resent — previous link is no longer valid'
          : 'Recorded tech test invite sent',
      );
      onInvited();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'WRONG_STAGE') {
        setStale(true);
        onInvited();
      } else {
        toastError(error instanceof Error ? error.message : 'Invite failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function sendNow() {
    setSubmitting(true);
    try {
      await api(`/api/hr/candidates/${applicationId}/techtest/invite/send-now`, {
        method: 'POST',
      });
      toastSuccess('Recorded tech test invite will send shortly');
      onInvited();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Send now failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    setSubmitting(true);
    try {
      await api(`/api/hr/candidates/${applicationId}/techtest/invite/cancel`, {
        method: 'POST',
      });
      toastSuccess('Scheduled recorded tech test invite cancelled');
      onInvited();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Cancel failed');
    } finally {
      setSubmitting(false);
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
        boxShadow: `0 ${density.stageRail.sm.gap}px ${density.stageRail.lg.height}px ${palette.ink}10`,
      }}
    >
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          Recorded technical interview
        </Text>
        {stale ? (
          <Alert color="warning" title="Updated elsewhere">
            This candidate was updated by someone else. Refreshing…
          </Alert>
        ) : null}
        {showMissingHint ? (
          <Alert color="warning" title="No recorded test configured">
            No assessment configured for this job — author one, then send.
          </Alert>
        ) : null}
        {pending ? (
          <Stack gap="xs">
            <Text size="sm" fw={600} style={{ color: palette.ink }}>
              Recorded test scheduled — sends at {datetime(pending.scheduled_for)} (in{' '}
              {minutesUntil(pending.scheduled_for)} minutes)
            </Text>
            <Group gap="sm">
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Send recorded tech test invite now"
                color="success"
                loading={submitting}
                disabled={submitting}
                onClick={() => void sendNow()}
              >
                Send now
              </MotionButton>
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Cancel scheduled recorded tech test invite"
                variant="default"
                loading={submitting}
                disabled={submitting}
                onClick={() => void cancel()}
              >
                Cancel
              </MotionButton>
            </Group>
          </Stack>
        ) : (
          <>
            {techtest ? (
              <Group gap="md" wrap="wrap">
                <Badge color="accent" variant="light">
                  {labelOf(SITTING_STATUS, techtest.status)}
                </Badge>
                <Text size="sm">
                  Start by {datetime(techtest.invite_deadline)} · {techtest.duration_minutes} min
                  once started
                </Text>
                {techtest.late ? (
                  <Badge color="warning" variant="light">
                    Late
                  </Badge>
                ) : null}
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                Needs a working camera and microphone. The session is recorded. The clock starts
                when they press Start.
              </Text>
            )}
            <Group gap="sm">
              {showSend ? (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Send recorded tech test"
                  color="success"
                  loading={submitting}
                  disabled={submitting || !jobHasTechTest}
                  onClick={() => void invite()}
                >
                  Send recorded test
                </MotionButton>
              ) : null}
              {canResend ? (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Resend recorded tech test invite"
                  variant="default"
                  loading={submitting}
                  disabled={submitting}
                  onClick={() => void invite()}
                >
                  Resend
                </MotionButton>
              ) : null}
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}
