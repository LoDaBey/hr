'use client';

import { useCallback, useRef } from 'react';
import type RecordRTC from 'recordrtc';

/**
 * RecordRTC touches `window` at module scope — always dynamic-import.
 * Cap / stop / upload land in later T-25 steps.
 */
export function useRecorder() {
  const recorderRef = useRef<RecordRTC | null>(null);
  const recordingRef = useRef(false);

  const start = useCallback(async (stream: MediaStream) => {
    if (recordingRef.current) return;

    const RecordRTCCtor = (await import('recordrtc')).default;
    const rec = new RecordRTCCtor(stream, {
      type: 'video',
      timeSlice: 10000,
      videoBitsPerSecond: 500_000,
    });
    recorderRef.current = rec;
    recordingRef.current = true;
    rec.startRecording();
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec || !recordingRef.current) return null;

    return new Promise((resolve) => {
      rec.stopRecording(() => {
        const blob = rec.getBlob();
        try {
          rec.destroy();
        } catch {
          /* ignore */
        }
        recorderRef.current = null;
        recordingRef.current = false;
        resolve(blob ?? null);
      });
    });
  }, []);

  const isRecording = useCallback(() => recordingRef.current, []);

  return { start, stop, isRecording };
}
