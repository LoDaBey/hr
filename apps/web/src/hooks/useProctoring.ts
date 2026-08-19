'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useDocumentVisibility,
  useFullscreenDocument,
  useNetwork,
  useWindowEvent,
} from '@mantine/hooks';
import { api } from '@/lib/api';
import { dismissBanner, toastBanner } from '@/lib/toast';
import type { ProctoringEventInput } from '@/types/api';
import type { ProctoringSeverity } from '@/types/domain';

const FLUSH_MS = 5000;
const PROCTORING_TOAST_ID = 'proctoring-banner';
const DISPLAY_CHECK_MS = 15_000;

type ScreenWithExtended = Screen & { isExtended?: boolean };

function isExternalDisplayConnected(): boolean {
  if (typeof window === 'undefined') return false;
  return (window.screen as ScreenWithExtended).isExtended === true;
}

type UseProctoringArgs = {
  token: string;
  enabled: boolean;
  stream: MediaStream | null;
  screenStream?: MediaStream | null;
  /** Called when a required camera or microphone track ends or is muted. */
  onDeviceCritical?: (kind: 'camera' | 'mic') => void;
  /** Called when all required tracks are live again after a critical loss. */
  onDeviceRestored?: () => void;
  /** Called when screen share ends mid-session. */
  onScreenShareCritical?: () => void;
};

/**
 * Queues proctoring signals and flushes every 5s without blocking the UI.
 * Failed flushes leave events in the queue for the next tick.
 */
export function useProctoring({
  token,
  enabled,
  stream,
  screenStream,
  onDeviceCritical,
  onDeviceRestored,
  onScreenShareCritical,
}: UseProctoringArgs) {
  const queueRef = useRef<ProctoringEventInput[]>([]);
  const flushingRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const wasOnlineRef = useRef(true);
  const prevVisibilityRef = useRef<string | null>(null);
  const hiddenSinceRef = useRef<number | null>(null);
  const blurSinceRef = useRef<number | null>(null);
  const deviceCriticalRef = useRef(false);
  const externalDisplayRef = useRef(false);
  const visibility = useDocumentVisibility();
  const { fullscreen } = useFullscreenDocument();
  const network = useNetwork();
  const [sessionBanner, setSessionBanner] = useState<string | null>(null);

  const showBanner = useCallback((message: string | null) => {
    setSessionBanner(message);
    if (message == null) {
      dismissBanner(PROCTORING_TOAST_ID);
      return;
    }
    toastBanner(message, {
      id: PROCTORING_TOAST_ID,
      duration: Number.POSITIVE_INFINITY,
    });
  }, []);

  const enqueue = useCallback(
    (event: string, severity: ProctoringSeverity, metadata?: unknown) => {
      if (!enabled) return;
      queueRef.current.push({
        event_id: crypto.randomUUID(),
        event,
        severity,
        occurred_at: new Date().toISOString(),
        metadata: metadata ?? {},
      });
    },
    [enabled],
  );

  const flush = useCallback(async () => {
    if (!enabled || flushingRef.current || queueRef.current.length === 0) return;
    flushingRef.current = true;
    const batch = queueRef.current.slice();
    try {
      await api(`/api/techtest/${encodeURIComponent(token)}/event`, {
        method: 'POST',
        body: { token, events: batch },
      });
      const sent = new Set(batch.map((e) => e.event_id));
      queueRef.current = queueRef.current.filter((e) => !sent.has(e.event_id));
    } catch {
      // Keep the queue; retry on the next tick.
    } finally {
      flushingRef.current = false;
    }
  }, [enabled, token]);

  const flushNow = useCallback(async (): Promise<ProctoringEventInput[]> => {
    await flush();
    return queueRef.current.slice();
  }, [flush]);

  const takeUnflushed = useCallback((): ProctoringEventInput[] => {
    const left = queueRef.current.slice();
    queueRef.current = [];
    return left;
  }, []);

  useEffect(() => {
    if (!enabled) {
      prevVisibilityRef.current = visibility;
      return;
    }
    if (visibility === 'hidden' && prevVisibilityRef.current !== 'hidden') {
      hiddenSinceRef.current = Date.now();
      showBanner('Please stay on this tab until you submit.');
    } else if (visibility === 'visible' && prevVisibilityRef.current === 'hidden') {
      const since = hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      const duration_ms = since != null ? Date.now() - since : 0;
      enqueue('TAB_CHANGED', 'WARN', { duration_ms, visibility });
      if (!externalDisplayRef.current) showBanner(null);
    }
    prevVisibilityRef.current = visibility;
  }, [enabled, enqueue, showBanner, visibility]);

  useEffect(() => {
    if (!enabled) return;
    if (fullscreen) {
      wasFullscreenRef.current = true;
      if (!externalDisplayRef.current) showBanner(null);
      return;
    }
    if (wasFullscreenRef.current) {
      enqueue('FULLSCREEN_EXIT', 'CRITICAL');
      showBanner('Fullscreen was exited — this is flagged for review.');
    }
  }, [enabled, enqueue, fullscreen, showBanner]);

  useEffect(() => {
    if (!enabled) return;
    const online = network.online !== false;
    if (!online) {
      if (wasOnlineRef.current) {
        enqueue('CONNECTION_LOST', 'WARN');
      }
      wasOnlineRef.current = false;
      showBanner('Connection lost — your answers are kept locally until you reconnect.');
    } else if (!wasOnlineRef.current) {
      wasOnlineRef.current = true;
      if (!externalDisplayRef.current) showBanner(null);
    }
  }, [enabled, enqueue, network.online, showBanner]);

  useWindowEvent('blur', () => {
    if (!enabled) return;
    blurSinceRef.current = Date.now();
  });

  useWindowEvent('focus', () => {
    if (!enabled) return;
    const since = blurSinceRef.current;
    blurSinceRef.current = null;
    if (since == null) return;
    const duration_ms = Date.now() - since;
    enqueue('WINDOW_BLUR', 'WARN', { duration_ms });
  });

  useEffect(() => {
    if (!enabled || !stream) return;
    const tracks = stream.getTracks();
    const onEnded = (track: MediaStreamTrack) => () => {
      if (track.kind === 'video') {
        enqueue('CAMERA_OFF', 'CRITICAL', { reason: 'ended' });
        deviceCriticalRef.current = true;
        onDeviceCritical?.('camera');
        showBanner('Camera turned off — please turn it back on.');
      } else if (track.kind === 'audio') {
        enqueue('MIC_OFF', 'CRITICAL', { reason: 'ended' });
        deviceCriticalRef.current = true;
        onDeviceCritical?.('mic');
        showBanner('Microphone turned off — please turn it back on.');
      }
    };
    const onMute = (track: MediaStreamTrack) => () => {
      if (!track.muted) {
        if (deviceCriticalRef.current) {
          deviceCriticalRef.current = false;
          onDeviceRestored?.();
          if (!externalDisplayRef.current) showBanner(null);
        }
        return;
      }
      if (track.kind === 'video') {
        enqueue('CAMERA_OFF', 'CRITICAL', { reason: 'muted' });
        deviceCriticalRef.current = true;
        onDeviceCritical?.('camera');
        showBanner('Camera muted — please unmute it.');
      } else if (track.kind === 'audio') {
        enqueue('MIC_OFF', 'CRITICAL', { reason: 'muted' });
        deviceCriticalRef.current = true;
        onDeviceCritical?.('mic');
        showBanner('Microphone muted — please unmute it.');
      }
    };
    const onUnmute = (track: MediaStreamTrack) => () => {
      if (!track.muted && track.readyState === 'live' && track.enabled) {
        deviceCriticalRef.current = false;
        onDeviceRestored?.();
        if (!externalDisplayRef.current) showBanner(null);
      }
    };
    const cleanups: Array<() => void> = [];
    for (const track of tracks) {
      const ended = onEnded(track);
      const mute = onMute(track);
      track.addEventListener('ended', ended);
      track.addEventListener('mute', mute);
      track.addEventListener('unmute', onUnmute(track));
      cleanups.push(() => {
        track.removeEventListener('ended', ended);
        track.removeEventListener('mute', mute);
        track.removeEventListener('unmute', onUnmute(track));
      });
    }
    return () => {
      for (const fn of cleanups) fn();
    };
  }, [enabled, enqueue, onDeviceCritical, onDeviceRestored, showBanner, stream]);

  useEffect(() => {
    if (!enabled || !screenStream) return;
    const track = screenStream.getVideoTracks()[0];
    if (!track) return;

    const onEnded = () => {
      enqueue('SCREEN_SHARE_STOPPED', 'CRITICAL', { reason: 'ended' });
      onScreenShareCritical?.();
      showBanner('Screen sharing stopped — share your entire monitor again to continue.');
    };

    track.addEventListener('ended', onEnded);
    return () => track.removeEventListener('ended', onEnded);
  }, [enabled, enqueue, onScreenShareCritical, screenStream, showBanner]);

  useEffect(() => {
    if (!enabled) return;

    const checkDisplay = () => {
      const extended = isExternalDisplayConnected();
      if (extended && !externalDisplayRef.current) {
        externalDisplayRef.current = true;
        enqueue('EXTERNAL_DISPLAY', 'CRITICAL', { detected: true });
        showBanner('A second display was detected — this is flagged for review.');
      } else if (!extended) {
        externalDisplayRef.current = false;
      }
    };

    checkDisplay();
    const id = window.setInterval(checkDisplay, DISPLAY_CHECK_MS);
    return () => window.clearInterval(id);
  }, [enabled, enqueue, showBanner]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void flush();
    }, FLUSH_MS);
    return () => {
      window.clearInterval(id);
      dismissBanner(PROCTORING_TOAST_ID);
      setSessionBanner(null);
    };
  }, [enabled, flush]);

  const onPasteDetected = useCallback(
    (charCount?: number) => {
      enqueue('PASTE_DETECTED', 'WARN', { char_count: charCount ?? 0 });
    },
    [enqueue],
  );

  return { flushNow, takeUnflushed, onPasteDetected, sessionBanner };
}

export { isExternalDisplayConnected };
