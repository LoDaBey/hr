'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Checkbox,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { datetime } from '@/lib/format';
import { density, palette } from '@/theme';
import type { CandidateAssessmentGetResult } from '@/types/api';

type MediaState = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

export function TechInterviewPreflight({
  data,
  starting,
  startError,
  onStart,
}: {
  data: CandidateAssessmentGetResult;
  starting?: boolean;
  startError?: string | null;
  /** Receives the live MediaStream (ownership transfers — do not stop tracks here). */
  onStart: (stream: MediaStream | null) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requirements = data.requirements ?? {
    camera: true,
    mic: true,
    fullscreen: true,
    rules: [],
  };
  const needsMedia = requirements.camera || requirements.mic;
  const [mediaState, setMediaState] = useState<MediaState>(() =>
    needsMedia ? 'requesting' : 'ready',
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const applyMediaError = useCallback((error: unknown) => {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setMediaState('denied');
      setMediaError(
        'Camera or microphone access was blocked. Allow access in your browser settings for this site, then retry.',
      );
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setMediaState('error');
      setMediaError('No camera or microphone was found. Plug one in, then retry.');
    } else {
      setMediaState('error');
      setMediaError(
        error instanceof Error
          ? error.message
          : 'Could not access camera or microphone. Retry when ready.',
      );
    }
  }, []);

  const mediaConstraints = useCallback((): MediaStreamConstraints => {
    return {
      video: requirements.camera
        ? { width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
      audio: requirements.mic,
    };
  }, [requirements.camera, requirements.mic]);

  const requestMedia = useCallback(async () => {
    if (!needsMedia) {
      setMediaState('ready');
      return;
    }
    setMediaState('requesting');
    setMediaError(null);
    stopTracks();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setMediaState('ready');
    } catch (error) {
      applyMediaError(error);
    }
  }, [applyMediaError, mediaConstraints, needsMedia, stopTracks]);

  useEffect(() => {
    if (!needsMedia) return;

    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints());
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setMediaState('ready');
        setMediaError(null);
      } catch (error) {
        if (!cancelled) applyMediaError(error);
      }
    })();

    return () => {
      cancelled = true;
      // Only stop if we still own the stream (Start hands it off by nulling streamRef).
      stopTracks();
    };
  }, [applyMediaError, mediaConstraints, needsMedia, stopTracks]);

  const canStart = acceptedRules && (mediaState === 'ready' || !needsMedia) && !starting;

  const handleStart = async () => {
    if (!canStart) return;
    // Hand ownership to the parent so unmount cleanup does not kill the tracks.
    const stream = streamRef.current;
    streamRef.current = null;
    await onStart(stream);
  };

  return (
    <Stack gap="lg" maw={560} mx="auto" py="xl" px="md">
      <div>
        <Text size="sm" c="dimmed">
          {data.job_title}
        </Text>
        <Title order={1} style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing }}>
          {data.assessment.title}
        </Title>
        <Text mt="xs">
          Hi {data.candidate_name}. This session is recorded
          {requirements.camera || requirements.mic
            ? ' and needs a working camera and microphone'
            : ''}
          .
        </Text>
      </div>

      <Paper
        withBorder
        p="md"
        radius={density.defaultRadius}
        style={{ borderColor: `${palette.ink}14`, background: palette.paper }}
      >
        <Stack gap="sm">
          <Text size="sm">
            Time limit: <strong>{data.assessment.duration_minutes} minutes</strong> once you
            start · {data.assessment.question_count} question
            {data.assessment.question_count === 1 ? '' : 's'}
          </Text>
          <Text size="sm" c="dimmed">
            Start before {datetime(data.invite_deadline)}. The clock does not start until you
            press Start.
          </Text>
          {data.assessment.instructions ? (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {data.assessment.instructions}
            </Text>
          ) : null}
        </Stack>
      </Paper>

      {requirements.rules.length > 0 ? (
        <Paper
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: `${palette.ink}14` }}
        >
          <Text fw={600} mb="xs">
            Rules
          </Text>
          <List size="sm" spacing="xs">
            {requirements.rules.map((rule) => (
              <List.Item key={rule}>{rule}</List.Item>
            ))}
          </List>
        </Paper>
      ) : null}

      {(requirements.camera || requirements.mic) && (
        <Paper
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: `${palette.ink}14`, overflow: 'hidden' }}
        >
          <Stack gap="sm">
            <Text fw={600}>Check your framing</Text>
            <Text size="sm" c="dimmed">
              Make sure your face is clear and your microphone is working. Nothing is recorded
              until you press Start.
            </Text>
            <div
              style={{
                position: 'relative',
                aspectRatio: '4 / 3',
                background: palette.ink,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                aria-label="Camera self-view"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
              {mediaState === 'requesting' ? (
                <Group
                  justify="center"
                  align="center"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `${palette.ink}cc`,
                  }}
                >
                  <Loader color="accent" aria-label="Requesting camera access" />
                </Group>
              ) : null}
            </div>

            {mediaState === 'denied' || mediaState === 'error' ? (
              <Alert color="danger" title="Device access needed">
                <Stack gap="sm">
                  <Text size="sm">{mediaError}</Text>
                  <MotionButton
                    className="cursor-pointer rounded-lg"
                    aria-label="Retry camera and microphone access"
                    variant="default"
                    onClick={() => void requestMedia()}
                  >
                    Retry
                  </MotionButton>
                </Stack>
              </Alert>
            ) : null}

            {mediaState === 'ready' ? (
              <Text size="sm" c="dimmed">
                Looking good. Accept the rules below when you are ready.
              </Text>
            ) : null}
          </Stack>
        </Paper>
      )}

      <Checkbox
        className="rounded outline-none"
        label="I have read and accept the rules"
        aria-label="I have read and accept the rules"
        checked={acceptedRules}
        onChange={(e) => setAcceptedRules(e.currentTarget.checked)}
      />

      {startError ? (
        <Alert color="danger" title="Could not start">
          {startError}
        </Alert>
      ) : null}

      <MotionButton
        className="cursor-pointer rounded-lg"
        aria-label="Start recorded interview"
        color="accent"
        disabled={!canStart}
        loading={starting}
        fullWidth
        onClick={() => void handleStart()}
      >
        Start
      </MotionButton>
    </Stack>
  );
}
