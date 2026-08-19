'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Stack, Text } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { palette } from '@/theme';

type DisplayMediaTrackSettings = MediaTrackSettings & {
  displaySurface?: string;
};

export function useScreenShareMonitor() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const releasedRef = useRef(false);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream]);

  const request = useCallback(async () => {
    setRequesting(true);
    setError(null);
    releasedRef.current = false;
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });
      const track = next.getVideoTracks()[0];
      const surface = (track?.getSettings() as DisplayMediaTrackSettings | undefined)
        ?.displaySurface;
      if (surface !== 'monitor') {
        next.getTracks().forEach((t) => t.stop());
        throw new Error(
          'Please share your entire monitor, not a single tab or window.',
        );
      }
      setStream(next);
      return next;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Screen sharing was cancelled or is not supported in this browser.';
      setError(message);
      return null;
    } finally {
      setRequesting(false);
    }
  }, [stream]);

  const release = useCallback(() => {
    releasedRef.current = true;
    const current = stream;
    setStream(null);
    return current;
  }, [stream]);

  useEffect(() => {
    return () => {
      if (!releasedRef.current) {
        stream?.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return { stream, error, requesting, request, stop, release, ready: Boolean(stream) };
}

export function ScreenSharePreflightBlock({
  error,
  requesting,
  ready,
  onRequest,
}: {
  error: string | null;
  requesting: boolean;
  ready: boolean;
  onRequest: () => void;
}) {
  if (ready) {
    return (
      <Text size="sm" fw={600} style={{ color: palette.success }}>
        Entire monitor shared
      </Text>
    );
  }

  return (
    <Alert color="warning" title="Screen share required">
      <Stack gap="sm">
        <Text size="sm">
          Share your entire primary monitor — tab or window shares are not accepted.
        </Text>
        {error ? (
          <Text size="sm" style={{ color: palette.danger }}>
            {error}
          </Text>
        ) : null}
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Share entire monitor"
          color="accent"
          loading={requesting}
          onClick={() => void onRequest()}
        >
          Share monitor
        </MotionButton>
      </Stack>
    </Alert>
  );
}
