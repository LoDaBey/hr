'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Group, Loader, Stack, Text } from '@mantine/core';
import { isAnswered } from '@/app/assessment/[token]/components/AssessmentQuestionInput';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { palette } from '@/theme';
import type {
  CandidateAssessmentGetResult,
  CandidateAssessmentStartResult,
} from '@/types/api';
import { SelfViewThumbnail } from './SelfViewThumbnail';
import { SubmitConfirmationOverlay } from './SubmitConfirmationOverlay';
import { TechInterviewHeader } from './TechInterviewHeader';
import { TechInterviewQuestionCard } from './TechInterviewQuestionCard';

export function TechInterviewSitting({
  token,
  data,
  start,
  stream,
  recordingReady = true,
  paused = false,
  proctoringBanner = null,
  onPasteDetected,
  onSubmitRequest,
  submitting,
}: {
  token: string;
  data: CandidateAssessmentGetResult;
  start: CandidateAssessmentStartResult;
  stream: MediaStream | null;
  recordingReady?: boolean;
  paused?: boolean;
  proctoringBanner?: string | null;
  onPasteDetected?: (charCount?: number) => void;
  onSubmitRequest: (answers: Record<string, unknown>) => void | Promise<void>;
  submitting?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const row of data.answers ?? []) {
      map[row.question_id] = row.answer;
    }
    return map;
  });
  const answersRef = useRef(answers);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const pausedAccumRef = useRef(0);

  useEffect(() => {
    if (paused) {
      if (pausedAtRef.current == null) pausedAtRef.current = Date.now();
      return;
    }
    if (pausedAtRef.current != null) {
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const started = new Date(start.started_at).getTime();
    const tick = () => {
      setRecordingElapsedMs(Math.max(0, Date.now() - started));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [start.started_at]);

  useEffect(() => {
    const clockOffset = new Date(start.server_time).getTime() - Date.now();
    const tick = () => {
      const expires = new Date(start.expires_at).getTime();
      let pauseMs = pausedAccumRef.current;
      if (paused && pausedAtRef.current != null) {
        pauseMs += Date.now() - pausedAtRef.current;
      }
      setRemainingMs(expires - (Date.now() + clockOffset) + pauseMs);
    };
    const id = window.setInterval(tick, 250);
    const raf = window.requestAnimationFrame(tick);
    return () => {
      window.clearInterval(id);
      window.cancelAnimationFrame(raf);
    };
  }, [paused, start.expires_at, start.server_time]);

  const persist = useCallback(async () => {
    setSaving(true);
    try {
      const payload = Object.entries(answersRef.current).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));
      await api(`/api/techtest/${encodeURIComponent(token)}/save`, {
        method: 'POST',
        body: { answers: payload },
      });
      setSavedAt(Date.now());
    } catch {
      // Autosave must never interrupt the candidate.
    } finally {
      setSaving(false);
    }
  }, [token]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void persist();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [persist]);

  useEffect(() => {
    if (submitting) setConfirmOpen(true);
  }, [submitting]);

  useEffect(() => {
    if (paused) return;
    if (remainingMs != null && remainingMs <= 0) {
      void onSubmitRequest(answersRef.current);
    }
  }, [onSubmitRequest, paused, remainingMs]);

  const questions = data.questions;
  const current = questions[index];
  const unanswered = useMemo(
    () => questions.filter((q) => !isAnswered(answers[q.id])),
    [answers, questions],
  );

  const savedLabel = saving ? 'Saving…' : savedAt ? 'Saved' : null;

  if (!recordingReady) {
    return (
      <Group justify="center" py="xl" style={{ minHeight: '60vh', background: palette.paper }}>
        <Stack align="center" gap="sm">
          <Loader color="accent" aria-label="Starting recording" />
          <Text size="sm" c="dimmed">
            Starting recording…
          </Text>
        </Stack>
      </Group>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: palette.paper, paddingBottom: 120 }}>
      <TechInterviewHeader
        jobTitle={data.job_title}
        assessmentTitle={data.assessment.title}
        remainingMs={remainingMs}
        recordingElapsedMs={recordingElapsedMs}
      />

      {proctoringBanner ? (
        <Alert
          color="warning"
          variant="light"
          mx="md"
          mt="sm"
          styles={{
            root: {
              borderColor: `${palette.warning}55`,
              backgroundColor: `${palette.warning}12`,
            },
          }}
        >
          {proctoringBanner}
        </Alert>
      ) : null}

      <Stack gap="lg" py="lg" px="md" align="center">
        {current ? (
          <TechInterviewQuestionCard
            question={current}
            index={index}
            total={questions.length}
            value={answers[current.id]}
            savedLabel={savedLabel}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [current.id]: next }))}
            onPasteDetected={onPasteDetected}
          />
        ) : null}

        <Group justify="space-between" maw={860} w="100%">
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Previous question"
            variant="default"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </MotionButton>
          {index < questions.length - 1 ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Next question"
              color="accent"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              Next
            </MotionButton>
          ) : (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Submit recorded interview"
              color="accent"
              loading={submitting}
              disabled={submitting}
              onClick={() => setConfirmOpen(true)}
            >
              Submit
            </MotionButton>
          )}
        </Group>
      </Stack>

      <SelfViewThumbnail stream={stream} />

      <SubmitConfirmationOverlay
        open={confirmOpen}
        submitting={submitting}
        unansweredCount={unanswered.length}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={() => void onSubmitRequest(answersRef.current)}
      />
    </div>
  );
}
