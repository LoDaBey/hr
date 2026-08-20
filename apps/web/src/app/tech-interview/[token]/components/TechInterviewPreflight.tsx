'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Checkbox,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { supportsDisplayMedia } from '@/lib/display-media';
import {
  deviceTrackStatus,
  formatDeviceStatus,
  streamMeetsRequirements,
  type MediaRequirements,
} from '@/lib/media-stream';
import { isExternalDisplayConnected } from '@/hooks/useProctoring';
import { density, palette } from '@/theme';
import type { CandidateAssessmentGetResult } from '@/types/api';
import { PreflightDesktopRequired } from './PreflightDesktopRequired';
import { PreflightRules } from './PreflightRules';
import { PreflightSessionInfo } from './PreflightSessionInfo';
import {
  ScreenSharePreflightBlock,
  useScreenShareMonitor,
} from './ScreenSharePreflight';

type MediaState = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

const PREVIEW_TIMEOUT_MS = 10_000;
const PREVIEW_TIMEOUT_MESSAGE =
  'We could not display your camera. It may be in use by another application — close other video apps and retry.';

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
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detachListenersRef = useRef<(() => void) | null>(null);

  const requirements: MediaRequirements = {
    camera: data.requirements?.camera ?? true,
    mic: data.requirements?.mic ?? true,
  };
  const needsScreenShare = data.requirements?.screen_share === true;
  const [displayMediaSupported, setDisplayMediaSupported] = useState<boolean | null>(null);
  const screenShareUnsupported = needsScreenShare && displayMediaSupported === false;
  const screenShare = useScreenShareMonitor();
  const [externalDisplay, setExternalDisplay] = useState(() => isExternalDisplayConnected());

  useEffect(() => {
    setDisplayMediaSupported(supportsDisplayMedia() === true);
  }, []);

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

  const clearPreviewTimeout = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    clearPreviewTimeout();
    detachListenersRef.current?.();
    detachListenersRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTrackStatus(deviceTrackStatus(null, requirements));
  }, [clearPreviewTimeout, requirements]);

  const applyMediaError = useCallback(
    (error: unknown) => {
      clearPreviewTimeout();
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
    },
    [clearPreviewTimeout, refreshTrackStatus],
  );

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

  const finishReadyFromTracks = useCallback(
    (stream: MediaStream) => {
      clearPreviewTimeout();
      const live = streamMeetsRequirements(stream, requirements);
      setMediaState(live ? 'ready' : 'error');
      if (!live) {
        setMediaError('Camera or microphone is not active. Check your devices, then retry.');
      } else {
        setMediaError(null);
      }
      refreshTrackStatus();
    },
    [clearPreviewTimeout, refreshTrackStatus, requirements],
  );

  const bindStreamToElement = useCallback(
    (el: HTMLVideoElement, stream: MediaStream) => {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      void el.play().catch(() => undefined);
    },
    [],
  );

  /** Callback ref so the stream attaches the moment the element mounts. */
  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current) {
        bindStreamToElement(el, streamRef.current);
      }
    },
    [bindStreamToElement],
  );

  const armPreviewTimeout = useCallback(() => {
    clearPreviewTimeout();
    previewTimeoutRef.current = setTimeout(() => {
      setMediaState('error');
      setMediaError(PREVIEW_TIMEOUT_MESSAGE);
    }, PREVIEW_TIMEOUT_MS);
  }, [clearPreviewTimeout]);

  const onPreviewFrame = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    finishReadyFromTracks(stream);
  }, [finishReadyFromTracks]);

  const acquireMedia = useCallback(async () => {
    checkExternalDisplay();
    if (!needsMedia) {
      setMediaState('ready');
      return;
    }

    setMediaState('requesting');
    setMediaError(null);
    stopTracks();
    armPreviewTimeout();

    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints());
      streamRef.current = stream;
      detachListenersRef.current = attachStreamListeners(stream);

      const el = videoRef.current;
      if (el) {
        bindStreamToElement(el, stream);
      }

      // Mic-only: no camera frame to wait for — ready from tracks.
      if (!requirements.camera) {
        finishReadyFromTracks(stream);
        return;
      }

      // Camera: stay in requesting until the element fires loadedmetadata / canplay.
      refreshTrackStatus();
    } catch (error) {
      applyMediaError(error);
    }
  }, [
    applyMediaError,
    armPreviewTimeout,
    attachStreamListeners,
    bindStreamToElement,
    checkExternalDisplay,
    finishReadyFromTracks,
    mediaConstraints,
    needsMedia,
    refreshTrackStatus,
    requirements.camera,
    stopTracks,
  ]);

  useEffect(() => {
    if (needsScreenShare && displayMediaSupported === null) return;
    if (screenShareUnsupported || !needsMedia) return;
    void acquireMedia();
    return () => {
      stopTracks();
    };
    // Acquire once media support is known; do not re-run when callback identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gated mount acquire
  }, [displayMediaSupported, screenShareUnsupported, needsMedia, needsScreenShare]);

  // Derive from trackStatus state (kept in sync via refreshTrackStatus), not streamRef —
  // reading refs during render is invalid in React.
  const devicesLive =
    (!requirements.camera || trackStatus.camera === 'on') &&
    (!requirements.mic || trackStatus.mic === 'on');
  const screenShareReady = !needsScreenShare || screenShare.ready;
  const canStart =
    !screenShareUnsupported &&
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

  if (screenShareUnsupported) {
    return (
      <Stack gap="xl" maw={640} mx="auto" py={{ base: 'lg', md: 'xl' }} px="md">
        <div>
          <Text
            size="xs"
            fw={600}
            tt="uppercase"
            style={{ color: palette.muted, letterSpacing: '0.06em' }}
          >
            {data.job_title}
          </Text>
          <Title
            order={1}
            mt={6}
            style={{
              color: palette.ink,
              letterSpacing: density.titleLetterSpacing,
              fontSize: 'clamp(1.5rem, 2.5vw, 1.85rem)',
            }}
          >
            {data.assessment.title}
          </Title>
        </div>
        <PreflightDesktopRequired />
      </Stack>
    );
  }

  return (
    <Stack gap="xl" maw={1100} mx="auto" py={{ base: 'lg', md: 'xl' }} px="md">
      <div>
        <Text
          size="xs"
          fw={600}
          tt="uppercase"
          style={{ color: palette.muted, letterSpacing: '0.06em' }}
        >
          {data.job_title}
        </Text>
        <Title
          order={1}
          mt={6}
          style={{
            color: palette.ink,
            letterSpacing: density.titleLetterSpacing,
            fontSize: 'clamp(1.5rem, 2.5vw, 1.85rem)',
          }}
        >
          {data.assessment.title}
        </Title>
        <Text mt="sm" size="sm" maw={640}>
          Hi {data.candidate_name}. This session is recorded
          {requirements.camera || requirements.mic
            ? ' and needs a working camera and microphone'
            : ''}
          .
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" verticalSpacing="lg">
        <Stack gap="md">
          <PreflightSessionInfo data={data} />
          <PreflightRules rules={data.requirements?.rules ?? []} />
        </Stack>

        <Stack gap="md">
          {needsScreenShare ? (
            <Alert color="warning" title="Desktop or laptop required">
              <Text size="sm">
                This session must be taken on a desktop or laptop computer. Phones and tablets
                cannot share an entire screen.
              </Text>
            </Alert>
          ) : null}

          {needsMedia ? (
            <Paper
              withBorder
              p="md"
              radius={density.defaultRadius}
              style={{
                borderColor: palette.border,
                overflow: 'hidden',
                background: palette.surface,
              }}
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
                    ref={attachVideo}
                    muted
                    playsInline
                    autoPlay
                    onLoadedMetadata={onPreviewFrame}
                    onCanPlay={onPreviewFrame}
                    aria-label="Camera self-view"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      opacity: mediaState === 'ready' && devicesLive ? 1 : 0.35,
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
                        onClick={() => void acquireMedia()}
                      >
                        Retry
                      </MotionButton>
                    </Stack>
                  </Alert>
                ) : null}

                {mediaState === 'ready' && devicesLive ? (
                  <Text size="sm" c="dimmed">
                    Looking good. Accept the rules when you are ready to start.
                  </Text>
                ) : null}
              </Stack>
            </Paper>
          ) : null}

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

          <Paper
            withBorder
            p="md"
            radius={density.defaultRadius}
            style={{ borderColor: palette.border, background: palette.surface }}
          >
            <Stack gap="md">
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
          </Paper>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
