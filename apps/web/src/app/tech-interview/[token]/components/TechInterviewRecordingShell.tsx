'use client';

import { useEffect, useRef } from 'react';
import { Group, Paper, Stack, Text, Title } from '@mantine/core';
import { density, palette } from '@/theme';
import type { CandidateAssessmentStartResult } from '@/types/api';

/** Live shell used while T-25.3–5 land; questions replace the placeholder in T-25.4. */
export function TechInterviewRecordingShell({
  stream,
  start,
  jobTitle,
  assessmentTitle,
}: {
  stream: MediaStream | null;
  start: CandidateAssessmentStartResult;
  jobTitle: string;
  assessmentTitle: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <Stack gap="lg" maw={560} mx="auto" py="xl" px="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="sm" c="dimmed">
            {jobTitle}
          </Text>
          <Title order={2} style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing }}>
            {assessmentTitle}
          </Title>
        </div>
        <Group gap="xs" aria-label="Recording in progress">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: palette.danger,
              display: 'inline-block',
            }}
          />
          <Text size="sm" fw={600} style={{ color: palette.danger }}>
            Recording
          </Text>
        </Group>
      </Group>

      <Paper
        withBorder
        p="md"
        radius={density.defaultRadius}
        style={{ borderColor: `${palette.ink}14`, background: palette.paper }}
      >
        <Stack gap="sm">
          <Text size="sm">
            Session started. The clock is running until{' '}
            <strong>{new Date(start.expires_at).toLocaleString()}</strong>.
          </Text>
          <Text size="sm" c="dimmed">
            Stay in fullscreen. Tab switches and camera issues are logged for the hiring team.
          </Text>
        </Stack>
      </Paper>

      {stream ? (
        <div
          style={{
            position: 'relative',
            aspectRatio: '4 / 3',
            background: palette.ink,
            borderRadius: 8,
            overflow: 'hidden',
            maxWidth: 320,
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            aria-label="Live self-view while recording"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
        </div>
      ) : null}
    </Stack>
  );
}
