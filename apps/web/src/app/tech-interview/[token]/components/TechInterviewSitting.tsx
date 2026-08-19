'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  AssessmentQuestionInput,
  isAnswered,
} from '@/app/assessment/[token]/components/AssessmentQuestionInput';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { density, palette } from '@/theme';
import type {
  CandidateAssessmentGetResult,
  CandidateAssessmentStartResult,
} from '@/types/api';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TechInterviewSitting({
  token,
  data,
  start,
  stream,
  recordingReady = true,
  paused = false,
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
  onPasteDetected?: () => void;
  onSubmitRequest: (answers: Record<string, unknown>) => void | Promise<void>;
  submitting?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    // Capture offset once when the session clock is known (not during render).
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
  }, [start.expires_at, start.server_time]);

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
    <Stack gap="md" maw={800} mx="auto" py="md" px="md" style={{ position: 'relative' }}>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <div>
          <Text size="sm" c="dimmed">
            {data.job_title}
          </Text>
          <Title order={2} style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing }}>
            {data.assessment.title}
          </Title>
        </div>
        <Group gap="md" align="center">
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
          <Text
            fw={700}
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: remainingMs != null && remainingMs < 60_000 ? palette.danger : palette.ink,
            }}
            aria-label="Time remaining"
          >
            {remainingMs == null ? '—' : formatRemaining(remainingMs)}
          </Text>
          {stream ? (
            <div
              style={{
                width: 120,
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
                aria-label="Live self-view"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
            </div>
          ) : null}
        </Group>
      </Group>

      <Group gap="xs" wrap="wrap" aria-label="Question navigation">
        {questions.map((q, i) => {
          const done = isAnswered(answers[q.id]);
          const active = i === index;
          return (
            <UnstyledButton
              key={q.id}
              className="cursor-pointer rounded-lg"
              aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
              onClick={() => setIndex(i)}
              style={{
                width: 36,
                height: 36,
                border: `1px solid ${active ? palette.accent : `${palette.ink}22`}`,
                background: done ? `${palette.accent}18` : palette.paper,
                color: palette.ink,
                fontWeight: active ? 700 : 500,
              }}
            >
              {i + 1}
            </UnstyledButton>
          );
        })}
      </Group>

      {current ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Question {index + 1} of {questions.length}
          </Text>
          <Text fw={600} style={{ whiteSpace: 'pre-wrap' }}>
            {current.prompt}
          </Text>
          <AssessmentQuestionInput
            question={current}
            value={answers[current.id]}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [current.id]: next }))}
            onPasteDetected={onPasteDetected}
          />
        </Stack>
      ) : null}

      <Group justify="space-between">
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Previous question"
          variant="default"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </MotionButton>
        <Text size="sm" c="dimmed">
          {saving ? 'Saving…' : savedAt ? 'Saved' : null}
        </Text>
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
            onClick={() => setConfirmOpen(true)}
          >
            Submit
          </MotionButton>
        )}
      </Group>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit your answers?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            {unanswered.length === 0
              ? 'All questions have an answer. Submit to end recording and upload your session.'
              : `${unanswered.length} question${unanswered.length === 1 ? '' : 's'} still blank. You can still submit.`}
          </Text>
          <Group justify="flex-end">
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Cancel submit"
              variant="default"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Confirm submit"
              color="accent"
              loading={submitting}
              onClick={() => void onSubmitRequest(answersRef.current)}
            >
              Submit now
            </MotionButton>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
