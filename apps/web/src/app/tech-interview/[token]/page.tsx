'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Group, Loader, Stack, Text, Title } from '@mantine/core';
import useSWR from 'swr';
import { RecordingUploadProgress } from './components/RecordingUploadProgress';
import { SessionDeviceBlockOverlay } from './components/SessionDeviceBlockOverlay';
import { TechInterviewPreflight } from './components/TechInterviewPreflight';
import { TechInterviewSitting } from './components/TechInterviewSitting';
import { MotionButton } from '@/components/MotionButton';
import { useProctoring } from '@/hooks/useProctoring';
import { useRecorder } from '@/hooks/useRecorder';
import { ApiError, api } from '@/lib/api';
import { uploadChunkedToCloudinary } from '@/lib/cloudinary-client';
import { requestEntireMonitorShare } from '@/lib/display-media';
import {
  replaceStreamTracks,
  streamMeetsRequirements,
  type MediaRequirements,
} from '@/lib/media-stream';
import { toastError, toastSuccess } from '@/lib/toast';
import { palette } from '@/theme';
import type {
  CandidateAssessmentGetResult,
  CandidateAssessmentStartResult,
  CloudinarySignatureResult,
  RecordingInput,
  TechTestStartPayload,
  TechTestSubmitResult,
} from '@/types/api';

function TokenMessage({ title, message }: { title: string; message: string }) {
  return (
    <Stack
      gap="md"
      maw={480}
      mx="auto"
      py="xl"
      px="md"
      align="center"
      style={{ minHeight: '60vh', background: palette.paper }}
    >
      <Title order={1} ta="center" style={{ color: palette.ink }}>
        {title}
      </Title>
      <Text ta="center" c="dimmed">
        {message}
      </Text>
    </Stack>
  );
}

type UploadResume = {
  blob: Blob;
  signature: CloudinarySignatureResult;
  uniqueUploadId: string;
  startByte: number;
  meta: { started_at: string; ended_at: string; part_no: number };
};

export default function TechInterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { start: startRecorder, stop: stopRecorder } = useRecorder();
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAt = useRef<string | null>(null);
  const partNoRef = useRef(1);
  const submittedRef = useRef(false);

  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [liveScreenStream, setLiveScreenStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<
    'preflight' | 'live' | 'done' | 'uploading' | 'upload_pending'
  >('preflight');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startResult, setStartResult] = useState<CandidateAssessmentStartResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(
    null,
  );
  const [uploadResume, setUploadResume] = useState<UploadResume | null>(null);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [deviceBlockKind, setDeviceBlockKind] = useState<'camera' | 'mic' | 'screen' | null>(null);
  const [restoringDevices, setRestoringDevices] = useState(false);
  const [recordingReady, setRecordingReady] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<CandidateAssessmentGetResult>(
    token ? `/api/techtest/${encodeURIComponent(token)}` : null,
    (url: string) => api<CandidateAssessmentGetResult>(url),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const mediaRequirements: MediaRequirements = {
    camera: data?.requirements?.camera ?? true,
    mic: data?.requirements?.mic ?? true,
  };

  const { flushNow, takeUnflushed, onPasteDetected, sessionBanner } = useProctoring({
    token,
    enabled: phase === 'live' && recordingReady,
    stream: liveStream,
    screenStream: liveScreenStream,
    onDeviceCritical: (kind) => {
      setDeviceBlockKind(kind);
      setDeviceBlocked(true);
    },
    onDeviceRestored: () => {
      if (liveStream && streamMeetsRequirements(liveStream, mediaRequirements)) {
        setDeviceBlocked(false);
        setDeviceBlockKind(null);
      }
    },
    onScreenShareCritical: () => {
      setDeviceBlockKind('screen');
      setDeviceBlocked(true);
    },
  });

  const cleanupMedia = useCallback(async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    screenStreamRef.current = null;
    setLiveStream(null);
    setLiveScreenStream(null);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      screenStreamRef.current = null;
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== 'live' && phase !== 'uploading') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  const runChunkedUpload = useCallback(
    async (resume: UploadResume): Promise<RecordingInput> => {
      const uploaded = await uploadChunkedToCloudinary(resume.blob, resume.signature, {
        filename: 'session.webm',
        startByte: resume.startByte,
        uniqueUploadId: resume.uniqueUploadId,
        onProgress: (p) => setUploadProgress(p),
      });

      return {
        public_id: uploaded.public_id,
        format: uploaded.format || 'webm',
        duration_seconds: uploaded.duration_seconds ?? 0,
        bytes: uploaded.bytes,
        started_at: resume.meta.started_at,
        ended_at: resume.meta.ended_at,
        part_no: resume.meta.part_no,
      };
    },
    [],
  );

  const finishRecordingUpload = useCallback(
    async (recording: RecordingInput) => {
      await api(`/api/techtest/${encodeURIComponent(token)}/recording`, {
        method: 'POST',
        body: { recording },
      });
      setUploadResume(null);
      setUploadProgress(null);
      setPhase('done');
      toastSuccess('Recording uploaded');
    },
    [token],
  );

  const handleSubmit = useCallback(
    async (answersMap: Record<string, unknown>) => {
      if (submittedRef.current || !token) return;
      submittedRef.current = true;
      setSubmitting(true);
      setStartError(null);

      try {
        await flushNow();
        const leftoverEvents = takeUnflushed();
        const answers = Object.entries(answersMap).map(([question_id, answer]) => ({
          question_id,
          answer,
        }));

        const blob = await stopRecorder();
        const meta = {
          started_at:
            recordingStartedAt.current ?? startResult?.started_at ?? new Date().toISOString(),
          ended_at: new Date().toISOString(),
          part_no: partNoRef.current,
        };

        // 1. Answers first — never wait on video.
        const result = await api<TechTestSubmitResult>(
          `/api/techtest/${encodeURIComponent(token)}/submit`,
          {
            method: 'POST',
            body: {
              answers,
              events: leftoverEvents,
            },
          },
        );

        await cleanupMedia();
        void mutate();

        if (!blob) {
          setPhase(result.recording_status === 'UPLOAD_PENDING' ? 'upload_pending' : 'done');
          return;
        }

        // 2. Signature once for the whole file, then chunked upload.
        setPhase('uploading');
        setUploadProgress({ loaded: 0, total: blob.size });

        const signature = await api<CloudinarySignatureResult>('/api/upload/signature', {
          method: 'POST',
          body: { kind: 'video', token },
        });

        const uniqueUploadId = crypto.randomUUID().replace(/-/g, '');
        const resume: UploadResume = {
          blob,
          signature,
          uniqueUploadId,
          startByte: 0,
          meta,
        };
        setUploadResume(resume);

        try {
          const recording = await runChunkedUpload(resume);
          await finishRecordingUpload(recording);
        } catch (err) {
          const bytesUploaded =
            err && typeof err === 'object' && 'bytesUploaded' in err
              ? Number((err as { bytesUploaded: number }).bytesUploaded)
              : resume.startByte;
          setUploadResume({
            ...resume,
            startByte: Number.isFinite(bytesUploaded) ? bytesUploaded : 0,
          });
          setStartError(err instanceof Error ? err.message : 'Recording upload failed');
          toastError(err instanceof Error ? err.message : 'Recording upload failed');
          setPhase('upload_pending');
        }
      } catch (err) {
        submittedRef.current = false;
        const message = err instanceof Error ? err.message : 'Submit failed';
        setStartError(message);
        toastError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      cleanupMedia,
      finishRecordingUpload,
      flushNow,
      mutate,
      runChunkedUpload,
      startResult,
      stopRecorder,
      takeUnflushed,
      token,
    ],
  );

  const handleRetryRecording = useCallback(async () => {
    if (!uploadResume || !token) return;
    const resume = uploadResume;
    setRetrying(true);
    setStartError(null);
    setPhase('uploading');
    setUploadProgress({ loaded: resume.startByte, total: resume.blob.size });

    try {
      const recording = await runChunkedUpload(resume);
      await finishRecordingUpload(recording);
    } catch (err) {
      const bytesUploaded =
        err && typeof err === 'object' && 'bytesUploaded' in err
          ? Number((err as { bytesUploaded: number }).bytesUploaded)
          : resume.startByte;
      setUploadResume({
        ...resume,
        startByte: Number.isFinite(bytesUploaded) ? bytesUploaded : resume.startByte,
      });
      setStartError(err instanceof Error ? err.message : 'Recording upload failed');
      toastError(err instanceof Error ? err.message : 'Recording upload failed');
      setPhase('upload_pending');
    } finally {
      setRetrying(false);
    }
  }, [finishRecordingUpload, runChunkedUpload, token, uploadResume]);

  const handleResumeDevices = useCallback(async () => {
    if (deviceBlockKind === 'screen') {
      setRestoringDevices(true);
      setStartError(null);
      try {
        const next = await requestEntireMonitorShare();
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = next;
        setLiveScreenStream(next);
        setDeviceBlocked(false);
        setDeviceBlockKind(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not restore screen share';
        setStartError(message);
        toastError(message);
      } finally {
        setRestoringDevices(false);
      }
      return;
    }

    const stream = streamRef.current ?? liveStream;
    if (!stream) return;
    setRestoringDevices(true);
    setStartError(null);
    try {
      await replaceStreamTracks(stream, mediaRequirements);
      if (!streamMeetsRequirements(stream, mediaRequirements)) {
        throw new Error('Camera or microphone is still not active.');
      }
      setLiveStream(stream);
      setDeviceBlocked(false);
      setDeviceBlockKind(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not restore devices';
      setStartError(message);
      toastError(message);
    } finally {
      setRestoringDevices(false);
    }
  }, [deviceBlockKind, liveStream, mediaRequirements]);

  const handleStart = useCallback(
    async (
      stream: MediaStream | null,
      screenStream: MediaStream | null,
      preflightExternalDisplay: boolean,
    ) => {
      if (!token || !data) return;
      const requirements: MediaRequirements = {
        camera: data.requirements?.camera ?? true,
        mic: data.requirements?.mic ?? true,
      };
      const needsMedia = requirements.camera || requirements.mic;
      if (needsMedia && !streamMeetsRequirements(stream, requirements)) {
        setStartError('Camera and microphone must be active before you can start.');
        toastError('Camera and microphone must be active before you can start.');
        return;
      }

      setStarting(true);
      setStartError(null);
      setRecordingReady(false);

      if (data.status === 'STARTED') {
        partNoRef.current = 2;
      }

      const requireFullscreen = data.requirements?.fullscreen !== false;

      try {
        if (requireFullscreen) {
          const root = document.documentElement;
          if (!document.fullscreenElement && root.requestFullscreen) {
            await root.requestFullscreen();
          }
        }

        const payload: TechTestStartPayload = {
          token,
          accepted_rules: true,
          preflight_external_display: preflightExternalDisplay,
        };

        const result = await api<CandidateAssessmentStartResult>(
          `/api/techtest/${encodeURIComponent(token)}/start`,
          { method: 'POST', body: payload },
        );

        streamRef.current = stream;
        screenStreamRef.current = screenStream;
        setLiveStream(stream);
        setLiveScreenStream(screenStream);
        recordingStartedAt.current = new Date().toISOString();

        if (stream) {
          await startRecorder(stream);
          setRecordingReady(true);
        } else {
          setRecordingReady(true);
        }

        const capMs = (data.assessment.duration_minutes + 2) * 60_000;
        window.setTimeout(() => {
          void stopRecorder();
        }, capMs);

        setStartResult(result);
        setPhase('live');
      } catch (err) {
        stream?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setLiveStream(null);
    setLiveScreenStream(null);
        setRecordingReady(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not start the session.';
        setStartError(message);
        toastError(message);
      } finally {
        setStarting(false);
      }
    },
    [data, startRecorder, stopRecorder, token],
  );

  if (isLoading) {
    return (
      <Group justify="center" py="xl" style={{ minHeight: '60vh', background: palette.paper }}>
        <Loader aria-label="Loading interview" color="accent" />
      </Group>
    );
  }

  if (error) {
    const code = error instanceof ApiError ? error.code : '';
    if (code === 'ALREADY_SUBMITTED') {
      return (
        <TokenMessage
          title="Already submitted"
          message="You have already submitted this session. Thank you — our team will review it."
        />
      );
    }
    if (code === 'TOKEN_EXPIRED') {
      return (
        <TokenMessage
          title="Link expired"
          message="The window to start this interview has closed. Contact us if you had a technical problem."
        />
      );
    }
    return (
      <TokenMessage
        title="Link not valid"
        message="This interview link is not valid or is no longer active. Ask the hiring team to send a new one."
      />
    );
  }

  if (!data) {
    return (
      <Group justify="center" py="xl" style={{ background: palette.paper }}>
        <Alert color="danger">Could not load this interview.</Alert>
      </Group>
    );
  }

  if (phase === 'done') {
    return (
      <Stack
        gap="md"
        maw={480}
        mx="auto"
        py="xl"
        px="md"
        align="center"
        style={{ minHeight: '60vh', background: palette.paper }}
      >
        <Title order={1} ta="center" style={{ color: palette.ink }}>
          You&apos;re done
        </Title>
        <Text ta="center" c="dimmed">
          Your answers and recording were submitted successfully. You can close this tab — our
          team will review your session.
        </Text>
      </Stack>
    );
  }

  if (phase === 'uploading') {
    return (
      <Stack
        gap="md"
        maw={480}
        mx="auto"
        py="xl"
        px="md"
        align="center"
        style={{ minHeight: '100vh', background: palette.paper }}
      >
        <Title order={1} ta="center" style={{ color: palette.ink }}>
          Submitting…
        </Title>
        <Text ta="center" c="dimmed">
          Your answers are saved. Uploading your recording — please keep this tab open.
        </Text>
        {uploadProgress ? (
          <RecordingUploadProgress loaded={uploadProgress.loaded} total={uploadProgress.total} />
        ) : (
          <Loader aria-label="Uploading recording" color="accent" />
        )}
      </Stack>
    );
  }

  if (phase === 'upload_pending') {
    return (
      <Stack
        gap="md"
        maw={480}
        mx="auto"
        py="xl"
        px="md"
        align="center"
        style={{ minHeight: '60vh', background: palette.paper }}
      >
        <Title order={1} ta="center" style={{ color: palette.ink }}>
          Answers saved
        </Title>
        <Text ta="center" c="dimmed">
          Your answers are saved. We couldn&apos;t upload your recording — you can retry, or close
          this page and our team will follow up.
        </Text>
        {uploadProgress ? (
          <RecordingUploadProgress loaded={uploadProgress.loaded} total={uploadProgress.total} />
        ) : null}
        {startError ? (
          <Alert color="danger" title="Upload error">
            {startError}
          </Alert>
        ) : null}
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Retry recording upload"
          color="accent"
          loading={retrying}
          disabled={!uploadResume}
          onClick={() => void handleRetryRecording()}
        >
          Retry
        </MotionButton>
      </Stack>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: palette.paper }}>
      {phase === 'preflight' || !startResult ? (
        <TechInterviewPreflight
          data={data}
          starting={starting}
          startError={startError}
          onStart={handleStart}
        />
      ) : (
        <>
          <TechInterviewSitting
            token={token}
            data={data}
            start={startResult}
            stream={liveStream}
            recordingReady={recordingReady}
            paused={deviceBlocked}
            proctoringBanner={sessionBanner}
            onPasteDetected={onPasteDetected}
            onSubmitRequest={handleSubmit}
            submitting={submitting}
          />
          {deviceBlocked ? (
            <SessionDeviceBlockOverlay
              message={
                deviceBlockKind === 'mic'
                  ? 'Restore your microphone to continue.'
                  : deviceBlockKind === 'screen'
                    ? 'Share your entire monitor again to continue.'
                    : 'Restore your camera to continue.'
              }
              restoring={restoringDevices}
              onResume={() => void handleResumeDevices()}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
