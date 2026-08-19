'use client';

import { useState } from 'react';
import { Alert, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { ApiError, api } from '@/lib/api';
import { datetime, inviteDeadlineShort, time } from '@/lib/format';
import { SITTING_STATUS, labelOf } from '@/lib/labels';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { HrInviteResult, HrSendInviteNowResult } from '@/types/api';
import type { Communication, SittingStatus, Stage } from '@/types/domain';

const INVITE_STAGES: Stage[] = [
  'INITIAL_SHORTLISTED',
  'TECH_ASSESSMENT_SENT',
  'TECH_ASSESSMENT_STARTED',
];

export type AssessmentInviteSummary = {
  id: string;
  status: SittingStatus;
  invite_deadline: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  late: boolean;
  ai_score: number | null;
};

function findPendingInvite(
  communications: Communication[],
  sittingId: string | undefined,
): Communication | null {
  if (!sittingId) return null;
  const dedupe = `${sittingId}`;
  const pending = communications.find(
    (c) =>
      c.template_key === 'ASSESSMENT_INVITE' &&
      c.status === 'PENDING' &&
      c.dedupe_key.includes(dedupe),
  );
  if (!pending) return null;
  if (new Date(pending.scheduled_for).getTime() <= Date.now()) return null;
  return pending;
}

function findSentInvite(
  communications: Communication[],
  sittingId: string | undefined,
): Communication | null {
  if (!sittingId) return null;
  return (
    communications.find(
      (c) =>
        c.template_key === 'ASSESSMENT_INVITE' &&
        c.status === 'SENT' &&
        c.dedupe_key.includes(sittingId),
    ) ?? null
  );
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
}

export function AssessmentInviteBar({
  applicationId,
  stage,
  assessment,
  communications = [],
  jobHasAssessment = true,
  autoInviteSkipped = false,
  onInvited,
}: {
  applicationId: string;
  stage: Stage;
  assessment: AssessmentInviteSummary | null;
  communications?: Communication[];
  jobHasAssessment?: boolean;
  autoInviteSkipped?: boolean;
  onInvited: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const [sentAtOverride, setSentAtOverride] = useState<string | null>(null);

  if (!INVITE_STAGES.includes(stage)) {
    return null;
  }

  const pending = findPendingInvite(communications, assessment?.id);
  const sentInvite = findSentInvite(communications, assessment?.id);
  const sentAt = sentAtOverride ?? sentInvite?.sent_at ?? null;
  const canResend =
    !pending &&
    assessment != null &&
    (assessment.status === 'INVITED' || assessment.status === 'STARTED');
  const showSend = stage === 'INITIAL_SHORTLISTED' && !canResend && !pending;
  const showMissingHint =
    stage === 'INITIAL_SHORTLISTED' && (!jobHasAssessment || autoInviteSkipped) && !assessment;

  async function invite() {
    setSubmitting(true);
    setStale(false);
    try {
      await api<HrInviteResult>(`/api/hr/candidates/${applicationId}/assessment/invite`, {
        method: 'POST',
      });
      toastSuccess(
        canResend
          ? 'Assessment invite resent — previous link is no longer valid'
          : 'Assessment invite sent',
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
      const result = await api<HrSendInviteNowResult>(
        `/api/hr/candidates/${applicationId}/assessment/invite/send-now`,
        { method: 'POST' },
      );
      const deliveredAt = result.communication.sent_at ?? new Date().toISOString();
      setSentAtOverride(deliveredAt);
      toastSuccess(`Assessment invitation sent ${time(deliveredAt)}`);
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
      await api(`/api/hr/candidates/${applicationId}/assessment/invite/cancel`, {
        method: 'POST',
      });
      setSentAtOverride(null);
      toastSuccess('Assessment cancelled');
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
          Technical assessment
        </Text>
        {stale ? (
          <Alert color="warning" title="Updated elsewhere">
            This candidate was updated by someone else. Refreshing…
          </Alert>
        ) : null}
        {showMissingHint ? (
          <Alert color="warning" title="No assessment configured">
            No assessment configured for this job — author one, then send.
          </Alert>
        ) : null}
        {pending ? (
          <Stack gap="xs">
            <Text size="sm" fw={600} style={{ color: palette.ink }}>
              Assessment scheduled — sends at {datetime(pending.scheduled_for)} (in{' '}
              {minutesUntil(pending.scheduled_for)} minutes)
            </Text>
            <Group gap="sm">
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Send assessment invite now"
                color="success"
                loading={submitting}
                disabled={submitting}
                onClick={() => void sendNow()}
              >
                Send now
              </MotionButton>
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Cancel scheduled assessment invite"
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
            {sentAt ? (
              <Text size="sm" fw={600} style={{ color: palette.ink }}>
                Invitation sent {time(sentAt)}
                {assessment
                  ? ` · must start by ${inviteDeadlineShort(assessment.invite_deadline)}`
                  : ''}
              </Text>
            ) : null}
            {assessment ? (
              <Group gap="md" wrap="wrap">
                <Badge color="accent" variant="light">
                  {labelOf(SITTING_STATUS, assessment.status)}
                </Badge>
                {!sentAt ? (
                  <Text size="sm">
                    Start by {datetime(assessment.invite_deadline)} · {assessment.duration_minutes}{' '}
                    min once started
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    {assessment.duration_minutes} min once started
                  </Text>
                )}
                {assessment.late ? (
                  <Badge color="warning" variant="light">
                    Late
                  </Badge>
                ) : null}
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                No assessment invite sent yet. The clock starts when the candidate presses Start.
              </Text>
            )}
            <Group gap="sm">
              {showSend ? (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Send assessment"
                  color="success"
                  loading={submitting}
                  disabled={submitting || !jobHasAssessment}
                  onClick={() => void invite()}
                >
                  Send assessment
                </MotionButton>
              ) : null}
              {canResend ? (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Resend assessment invite"
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
