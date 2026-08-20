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
import {
  deviceTrackStatus,
  formatDeviceStatus,
  streamMeetsRequirements,
  type MediaRequirements,
} from '@/lib/media-stream';
import { isExternalDisplayConnected } from '@/hooks/useProctoring';
import { density, palette } from '@/theme';
import type { CandidateAssessmentGetResult } from '@/types/api';
import {
  ScreenSharePreflightBlock,
  useScreenShareMonitor,
} from './ScreenSharePreflight';

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
  /** Receives camera/mic stream and optional screen-share stream (ownership transfers). */
  onStart: (
    stream: MediaStream | null,
    screenStream: MediaStream | null,
    preflightExternalDisplay: boolean,
  ) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requirements: MediaRequirements = {
    camera: data.requirements?.camera ?? true,
    mic: data.requirements?.mic ?? true,
  };
  const needsScreenShare = data.requirements?.screen_share === true;
  const screenShare = useScreenShareMonitor();
  const [externalDisplay, setExternalDisplay] = useState(() => isExternalDisplayConnected());

  const checkExternalDisplay = useCallback(() => {
    setExternalDisplay(isExternalDisplayConnected());
  }, []);
  const needsMedia = requirements.camera || requirements.mic;

  const [mediaState, setMediaState] = useState<MediaState>(() =>
    needsMedia ? 'requesting' : 'ready',
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [trackStatus, setTrackStatus] = useState(() =>
    deviceTrackStatus(null, requirements),
  );

  const refreshTrackStatus = useCallback(() => {
    setTrackStatus(deviceTrackStatus(streamRef.current, requirements));
  }, [requirements]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTrackStatus(deviceTrackStatus(null, requirements));
  }, [requirements]);

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
    refreshTrackStatus();
  }, [refreshTrackStatus]);

  const mediaConstraints = useCallback((): MediaStreamConstraints => {
    return {
      video: requirements.camera
        ? { width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
      audio: requirements.mic,
    };
  }, [requirements.camera, requirements.mic]);

  const attachStreamListeners = useCallback(
    (stream: MediaStream) => {
      const onChange = () => refreshTrackStatus();
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', onChange);
        track.addEventListener('mute', onChange);
        track.addEventListener('unmute', onChange);
      }
      return () => {
        for (const track of stream.getTracks()) {
          track.removeEventListener('ended', onChange);
          track.removeEventListener('mute', onChange);
          track.removeEventListener('unmute', onChange);
        }
      };
    },
    [refreshTrackStatus],
  );

  const requestMedia = useCallback(async () => {
    checkExternalDisplay();
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
      const live = streamMeetsRequirements(stream, requirements);
      setMediaState(live ? 'ready' : 'error');
      if (!live) {
        setMediaError('Camera or microphone is not active. Check your devices, then retry.');
      }
      refreshTrackStatus();
    } catch (error) {
      applyMediaError(error);
    }
  }, [applyMediaError, checkExternalDisplay, mediaConstraints, needsMedia, refreshTrackStatus, requirements, stopTracks]);

  useEffect(() => {
    if (!needsMedia) return;

    let cancelled = false;
    let detachListeners: (() => void) | undefined;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints());
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        detachListeners = attachStreamListeners(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const live = streamMeetsRequirements(stream, requirements);
        setMediaState(live ? 'ready' : 'error');
        if (!live) {
          setMediaError('Camera or microphone is not active. Check your devices, then retry.');
        } else {
          setMediaError(null);
        }
        refreshTrackStatus();
      } catch (error) {
        if (!cancelled) applyMediaError(error);
      }
    })();

    return () => {
      cancelled = true;
      detachListeners?.();
      stopTracks();
    };
  }, [
    applyMediaError,
    attachStreamListeners,
    mediaConstraints,
    needsMedia,
    refreshTrackStatus,
    requirements,
    stopTracks,
  ]);

  // Derive from trackStatus state (kept in sync via refreshTrackStatus), not streamRef —
  // reading refs during render is invalid in React.
  const devicesLive =
    (!requirements.camera || trackStatus.camera === 'on') &&
    (!requirements.mic || trackStatus.mic === 'on');
  const screenShareReady = !needsScreenShare || screenShare.ready;
  const canStart =
    acceptedRules &&
    !starting &&
    !externalDisplay &&
    screenShareReady &&
    (needsMedia ? mediaState === 'ready' && devicesLive : true);

  const handleStart = async () => {
    if (!canStart) return;
    const stream = streamRef.current;
    if (needsMedia && !streamMeetsRequirements(stream, requirements)) return;
    streamRef.current = null;
    const screenStream = needsScreenShare ? screenShare.release() : null;
    await onStart(stream, screenStream, externalDisplay);
  };

  const deviceLabel = formatDeviceStatus(trackStatus);
  const showDeviceWarning =
    needsMedia &&
    mediaState === 'ready' &&
    !devicesLive &&
    (trackStatus.camera === 'off' || trackStatus.mic === 'off');

  return (
    <Stack gap="lg" maw={560} mx="auto" py="xl" px="md">
      <div>
        <Text size="xs" fw={600} tt="uppercase" style={{ color: palette.muted, letterSpacing: '0.06em' }}>
          {data.job_title}
        </Text>
        <Title order={1} mt={6} style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing, fontSize: '1.5rem' }}>
          {data.assessment.title}
        </Title>
        <Text mt="sm" size="sm">
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
        style={{ borderColor: palette.border, background: palette.surface }}
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

      {(data.requirements?.rules ?? []).length > 0 ? (
        <Paper
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: palette.border, background: palette.surface }}
        >
          <Text fw={600} mb="xs">
            Rules
          </Text>
          <List size="sm" spacing="xs">
            {(data.requirements?.rules ?? []).map((rule) => (
              <List.Item key={rule}>{rule}</List.Item>
            ))}
          </List>
        </Paper>
      ) : null}

      {needsMedia && (
        <Paper
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: palette.border, overflow: 'hidden', background: palette.surface }}
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
                  opacity: devicesLive ? 1 : 0.35,
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

            {mediaState === 'ready' && deviceLabel ? (
              <Text
                size="sm"
                fw={600}
                style={{
                  color:
                    devicesLive && !showDeviceWarning ? palette.success : palette.danger,
                }}
              >
                {deviceLabel}
              </Text>
            ) : null}

            {mediaState === 'denied' || mediaState === 'error' || showDeviceWarning ? (
              <Alert color="danger" title="Device access needed">
                <Stack gap="sm">
                  <Text size="sm">
                    {mediaError ??
                      'Camera or microphone is not active. Check your devices, then retry.'}
                  </Text>
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

            {mediaState === 'ready' && devicesLive ? (
              <Text size="sm" c="dimmed">
                Looking good. Accept the rules below when you are ready.
              </Text>
            ) : null}
          </Stack>
        </Paper>
      )}

      {externalDisplay ? (
        <Alert color="danger" title="Second display detected">
          <Stack gap="sm">
            <Text size="sm">
              A second display was detected. Please disconnect it before starting.
            </Text>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Re-check for second display"
              variant="default"
              onClick={() => checkExternalDisplay()}
            >
              Retry
            </MotionButton>
          </Stack>
        </Alert>
      ) : null}

      {needsScreenShare && !externalDisplay ? (
        <ScreenSharePreflightBlock
          error={screenShare.error}
          requesting={screenShare.requesting}
          ready={screenShare.ready}
          onRequest={() => void screenShare.request()}
        />
      ) : null}

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
        Start session
      </MotionButton>
    </Stack>
  );
}
