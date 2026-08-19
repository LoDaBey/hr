'use client';

import { useMemo, useRef } from 'react';
import { Badge, Group, Paper, Stack, Table, Text, Title } from '@mantine/core';
import {
  AssessmentReview,
  type AssessmentReviewData,
} from '@/components/hr/AssessmentReview';
import { datetime } from '@/lib/format';
import { density, palette } from '@/theme';
import type { ProctoringSeverity, RecordingStatus } from '@/types/domain';

export type TechTestProctorRow = {
  id: string;
  event: string;
  severity: ProctoringSeverity;
  occurred_at: string;
  metadata: unknown;
};

export type TechTestReviewData = AssessmentReviewData & {
  recording_status: RecordingStatus | null;
  recording: {
    public_id: string;
    format: string | null;
    duration_seconds: number | null;
    started_at: string | null;
    ended_at: string | null;
    signed_url: string | null;
  } | null;
  proctoring_flag: 'CLEAN' | 'MINOR_FLAGS' | 'REVIEW_RECORDING' | null;
  proctoring_summary: string | null;
  preflight_external_display: boolean | null;
  events: TechTestProctorRow[];
  session_started_at: string | null;
};

function flagColor(flag: TechTestReviewData['proctoring_flag']): string {
  if (flag === 'REVIEW_RECORDING') return 'danger';
  if (flag === 'MINOR_FLAGS') return 'warning';
  return 'success';
}

function offsetSeconds(
  sessionStartedAt: string | null,
  occurredAt: string,
): number | null {
  if (!sessionStartedAt) return null;
  const start = new Date(sessionStartedAt).getTime();
  const at = new Date(occurredAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((at - start) / 1000));
}

export function TechTestReview({
  review,
  applicationId,
  onGraded,
}: {
  review: TechTestReviewData;
  applicationId?: string;
  onGraded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recordingReady =
    review.recording_status === 'READY' && Boolean(review.recording?.signed_url);

  const flagLabel = review.proctoring_flag ?? 'CLEAN';

  const eventSummary = useMemo(() => {
    if (review.proctoring_summary) return review.proctoring_summary;
    const counted = review.events.filter((e) => e.severity !== 'INFO');
    if (counted.length === 0) return 'No proctoring flags.';
    return `${counted.length} flag${counted.length === 1 ? '' : 's'} logged.`;
  }, [review.events, review.proctoring_summary]);

  function seekTo(occurredAt: string) {
    const el = videoRef.current;
    if (!el) return;
    const offset = offsetSeconds(review.session_started_at ?? review.recording?.started_at ?? null, occurredAt);
    if (offset == null) return;
    el.currentTime = offset;
    void el.play().catch(() => undefined);
  }

  return (
    <Stack gap="lg">
      <AssessmentReview
        review={review}
        applicationId={applicationId}
        gradeKind="TECH_TEST"
        onGraded={onGraded}
      />

      <Paper
        withBorder
        p="md"
        radius={density.defaultRadius}
        style={{ borderColor: `${palette.ink}14` }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Title order={4}>Recording</Title>
            <Badge color={recordingReady ? 'success' : 'warning'} variant="light">
              {recordingReady ? 'Ready' : review.recording_status === 'UPLOAD_PENDING' ? 'Upload pending' : 'Recording missing'}
            </Badge>
          </Group>

          {recordingReady && review.recording?.signed_url ? (
            <>
              <video
                ref={videoRef}
                controls
                src={review.recording.signed_url}
                aria-label="Recorded technical interview"
                style={{
                  width: '100%',
                  maxHeight: 420,
                  background: palette.ink,
                  borderRadius: 8,
                }}
              />
              <Text size="sm" c="dimmed">
                {review.recording.duration_seconds != null
                  ? `Duration ${Math.round(review.recording.duration_seconds)}s`
                  : 'Duration unknown'}
                {review.recording.started_at ? ` · started ${datetime(review.recording.started_at)}` : ''}
                {review.recording.ended_at ? ` · ended ${datetime(review.recording.ended_at)}` : ''}
              </Text>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              The recording is not available to play yet
              {review.recording_status === 'UPLOAD_PENDING'
                ? ' — the candidate may still retry the upload.'
                : '.'}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper
        withBorder
        p="md"
        radius={density.defaultRadius}
        style={{ borderColor: `${palette.ink}14` }}
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Proctoring</Title>
            <Badge color={flagColor(flagLabel)} variant="light">
              {flagLabel.replaceAll('_', ' ')}
            </Badge>
          </Group>
          <Text size="sm">{eventSummary}</Text>
          {review.preflight_external_display ? (
            <Text size="sm" style={{ color: palette.warning }}>
              Started with a second display connected.
            </Text>
          ) : null}
          <Text size="xs" c="dimmed">
            Browser signals are advisory. They cannot detect a second computer, a phone, or a
            person off-camera. Watch the recording before deciding.
          </Text>

          {review.events.length === 0 ? (
            <Text c="dimmed" size="sm">
              No events logged.
            </Text>
          ) : (
            <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>When</Table.Th>
                  <Table.Th>Event</Table.Th>
                  <Table.Th>Severity</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {review.events.map((row) => {
                  const seekable = row.severity === 'CRITICAL' && recordingReady;
                  return (
                    <Table.Tr
                      key={row.id}
                      style={seekable ? { cursor: 'pointer' } : undefined}
                      onClick={seekable ? () => seekTo(row.occurred_at) : undefined}
                      aria-label={
                        seekable
                          ? `Seek recording to ${row.event} at ${datetime(row.occurred_at)}`
                          : undefined
                      }
                    >
                      <Table.Td>{datetime(row.occurred_at)}</Table.Td>
                      <Table.Td>{row.event.replaceAll('_', ' ')}</Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={
                            row.severity === 'CRITICAL'
                              ? 'danger'
                              : row.severity === 'WARN'
                                ? 'warning'
                                : 'ink'
                          }
                        >
                          {row.severity}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
