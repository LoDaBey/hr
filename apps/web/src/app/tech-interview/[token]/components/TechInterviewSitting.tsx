'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Group, Loader, Stack, Text, UnstyledButton } from '@mantine/core';
import { isAnswered } from '@/app/assessment/[token]/components/AssessmentQuestionInput';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { palette } from '@/theme';
import type {
  CandidateAssessmentGetResult,
  CandidateAssessmentStartResult,
  CandidateQuestion,
} from '@/types/api';
import { SelfViewThumbnail } from './SelfViewThumbnail';
import { SubmitConfirmationOverlay } from './SubmitConfirmationOverlay';
import { TechInterviewHeader } from './TechInterviewHeader';
import { TechInterviewQuestionCard } from './TechInterviewQuestionCard';

type SpokenTiming = {
  question_id: string;
  shown_at: string;
  left_at: string | null;
};

function spokenLabel(question: CandidateQuestion, answered: boolean): string {
  if (question.answer_mode === 'spoken') {
    return answered ? 'Answered aloud' : 'Speak aloud';
  }
  return answered ? 'Answered' : 'Not answered';
}

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
  const [timings, setTimings] = useState<SpokenTiming[]>([]);
  const timingsRef = useRef(timings);
  const shownAtRef = useRef<string | null>(null);
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
    timingsRef.current = timings;
  }, [timings]);

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

  const questions = data.questions;
  const current = questions[index];

  const closeSpokenTiming = useCallback((questionId: string) => {
    const shownAt = shownAtRef.current;
    if (!shownAt) return;
    const leftAt = new Date().toISOString();
    shownAtRef.current = null;
    setTimings((prev) => {
      const without = prev.filter((row) => row.question_id !== questionId);
      return [...without, { question_id: questionId, shown_at: shownAt, left_at: leftAt }];
    });
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        mode: 'spoken',
        shown_at: shownAt,
        left_at: leftAt,
      },
    }));
  }, []);

  useEffect(() => {
    if (!current) return;
    if (current.answer_mode !== 'spoken') {
      shownAtRef.current = null;
      return;
    }
    shownAtRef.current = new Date().toISOString();
    return () => {
      closeSpokenTiming(current.id);
    };
  }, [closeSpokenTiming, current]);

  const persist = useCallback(async () => {
    setSaving(true);
    try {
      const payload = Object.entries(answersRef.current).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));
      await api(`/api/techtest/${encodeURIComponent(token)}/save`, {
        method: 'POST',
        body: {
          answers: payload,
          spoken_question_timings: timingsRef.current.filter((row) => row.left_at),
        },
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
      if (current?.answer_mode === 'spoken') {
        closeSpokenTiming(current.id);
      }
      void onSubmitRequest(answersRef.current);
    }
  }, [closeSpokenTiming, current, onSubmitRequest, paused, remainingMs]);

  const unanswered = useMemo(
    () => questions.filter((q) => !isAnswered(answers[q.id])),
    [answers, questions],
  );

  const savedLabel = saving ? 'Saving…' : savedAt ? 'Saved' : null;

  function goTo(nextIndex: number) {
    if (current?.answer_mode === 'spoken') {
      closeSpokenTiming(current.id);
    }
    setIndex(nextIndex);
  }

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

      <Group align="flex-start" gap="md" py="lg" px="md" justify="center" wrap="nowrap">
        <Stack
          gap={4}
          p="sm"
          visibleFrom="sm"
          style={{
            width: 160,
            flexShrink: 0,
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: 8,
          }}
        >
          <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Questions
          </Text>
          {questions.map((q, i) => {
            const answered = isAnswered(answers[q.id]);
            const active = i === index;
            return (
              <UnstyledButton
                key={q.id}
                className="cursor-pointer rounded-lg"
                aria-label={`Go to question ${i + 1}, ${spokenLabel(q, answered)}`}
                onClick={() => goTo(i)}
                style={{
                  padding: '6px 8px',
                  textAlign: 'left',
                  background: active ? `${palette.accent}18` : 'transparent',
                  borderLeft: active ? `3px solid ${palette.accent}` : '3px solid transparent',
                  color: answered ? palette.success : palette.ink,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {i + 1}. {spokenLabel(q, answered)}
              </UnstyledButton>
            );
          })}
        </Stack>

        <Stack gap="lg" align="center" style={{ flex: 1, minWidth: 0 }}>
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
              onClick={() => goTo(Math.max(0, index - 1))}
            >
              Previous
            </MotionButton>
            {index < questions.length - 1 ? (
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Next question"
                color="accent"
                onClick={() => goTo(Math.min(questions.length - 1, index + 1))}
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
                onClick={() => {
                  if (current?.answer_mode === 'spoken') {
                    closeSpokenTiming(current.id);
                  }
                  setConfirmOpen(true);
                }}
              >
                Submit
              </MotionButton>
            )}
          </Group>
        </Stack>
      </Group>

      <SelfViewThumbnail stream={stream} />

      <SubmitConfirmationOverlay
        open={confirmOpen}
        submitting={submitting}
        unansweredCount={unanswered.length}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={() => {
          if (current?.answer_mode === 'spoken') {
            closeSpokenTiming(current.id);
          }
          void onSubmitRequest(answersRef.current);
        }}
      />
    </div>
  );
}
