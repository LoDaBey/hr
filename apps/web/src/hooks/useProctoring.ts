'use client';

import { useCallback, useEffect, useRef } from 'react';
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

type UseProctoringArgs = {
  token: string;
  enabled: boolean;
  stream: MediaStream | null;
  /** Called when a required camera or microphone track ends or is muted. */
  onDeviceCritical?: (kind: 'camera' | 'mic') => void;
  /** Called when all required tracks are live again after a critical loss. */
  onDeviceRestored?: () => void;
};

/**
 * Queues proctoring signals and flushes every 5s without blocking the UI.
 * Failed flushes leave events in the queue for the next tick.
 * Session notices are shown via react-hot-toast.
 */
export function useProctoring({
  token,
  enabled,
  stream,
  onDeviceCritical,
  onDeviceRestored,
}: UseProctoringArgs) {
  const queueRef = useRef<ProctoringEventInput[]>([]);
  const flushingRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const wasOnlineRef = useRef(true);
  const deviceCriticalRef = useRef(false);
  const visibility = useDocumentVisibility();
  const { fullscreen } = useFullscreenDocument();
  const network = useNetwork();

  const showBanner = useCallback((message: string | null) => {
    if (message == null) {
      dismissBanner(PROCTORING_TOAST_ID);
      return;
    }
    toastBanner(message, {
      id: PROCTORING_TOAST_ID,
      // Stay until cleared or replaced (connection / fullscreen issues).
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

  /** Drain remaining events (e.g. on submit). Does not throw. */
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
      enqueue('TAB_CHANGED', 'WARN', { visibility });
      showBanner('Please stay on this tab until you submit.');
    }
    prevVisibilityRef.current = visibility;
  }, [enabled, enqueue, showBanner, visibility]);

  useEffect(() => {
    if (!enabled) return;
    if (fullscreen) {
      wasFullscreenRef.current = true;
      showBanner(null);
      return;
    }
    if (wasFullscreenRef.current) {
      enqueue('FULLSCREEN_EXIT', 'WARN');
      showBanner('Please stay in fullscreen.');
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
      showBanner(null);
    }
  }, [enabled, enqueue, network.online, showBanner]);

  useWindowEvent('blur', () => {
    if (!enabled) return;
    enqueue('WINDOW_BLUR', 'INFO');
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
          showBanner(null);
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
        showBanner(null);
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
    if (!enabled) return;
    const id = window.setInterval(() => {
      void flush();
    }, FLUSH_MS);
    return () => {
      window.clearInterval(id);
      dismissBanner(PROCTORING_TOAST_ID);
    };
  }, [enabled, flush]);

  const onPasteDetected = useCallback(() => {
    enqueue('PASTE_DETECTED', 'INFO');
  }, [enqueue]);

  return { flushNow, takeUnflushed, onPasteDetected };
}
