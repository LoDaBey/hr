'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { ApiError, api } from '@/lib/api';
import { datetime } from '@/lib/format';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type {
  CandidateAssessmentGetResult,
  CandidateAssessmentStartResult,
  CandidateAssessmentSubmitResult,
  CandidateQuestion,
} from '@/types/api';
import { AssessmentQuestionInput, isAnswered } from './AssessmentQuestionInput';

const QUESTION_CARD_MIN_HEIGHT = 420;
const NAV_BAR_HEIGHT = 56;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AssessmentSitting({
  token,
  initial,
}: {
  token: string;
  initial: CandidateAssessmentGetResult;
}) {
  const [data, setData] = useState(initial);
  const [phase, setPhase] = useState<'intro' | 'sitting' | 'done'>(
    initial.status === 'STARTED' ? 'sitting' : initial.status === 'SUBMITTED' ? 'done' : 'intro',
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const row of initial.answers ?? []) {
      map[row.question_id] = row.answer;
    }
    return map;
  });
  const [clockOffset, setClockOffset] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(initial.expires_at);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const questions = data.questions;

  const unanswered = useMemo(() => {
    return questions.filter((q) => !isAnswered(answers[q.id]));
  }, [questions, answers]);

  const persist = useCallback(async () => {
    setSaving(true);
    try {
      const payload = Object.entries(answersRef.current).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));
      await api(`/api/assessment/${encodeURIComponent(token)}/save`, {
        method: 'POST',
        body: { answers: payload },
      });
      setSavedAt(new Date().toISOString());
    } catch {
      // Autosave must never interrupt the candidate.
    } finally {
      setSaving(false);
    }
  }, [token]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await persist();
      const payload = Object.entries(answersRef.current).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));
      await api<CandidateAssessmentSubmitResult>(
        `/api/assessment/${encodeURIComponent(token)}/submit`,
        { method: 'POST', body: { answers: payload } },
      );
      setPhase('done');
      setConfirmOpen(false);
      toastSuccess('Assessment submitted');
    } catch (err) {
      submittedRef.current = false;
      const message = err instanceof Error ? err.message : 'Submit failed';
      setError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  }, [persist, token]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const started = await api<CandidateAssessmentStartResult>(
        `/api/assessment/${encodeURIComponent(token)}/start`,
        { method: 'POST' },
      );
      const refreshed = await api<CandidateAssessmentGetResult>(
        `/api/assessment/${encodeURIComponent(token)}`,
      );
      setData(refreshed);
      setExpiresAt(started.expires_at);
      setClockOffset(Date.now() - Date.parse(started.server_time));
      setPhase('sitting');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not start';
      setError(message);
      toastError(message);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (initial.status !== 'STARTED') return;
    let cancelled = false;
    void (async () => {
      try {
        const started = await api<CandidateAssessmentStartResult>(
          `/api/assessment/${encodeURIComponent(token)}/start`,
          { method: 'POST' },
        );
        if (cancelled) return;
        setExpiresAt(started.expires_at);
        setClockOffset(Date.now() - Date.parse(started.server_time));
        setPhase('sitting');
      } catch {
        // leave intro / error from GET
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.status, token]);

  useEffect(() => {
    if (phase !== 'sitting' || !expiresAt) return;
    const tick = () => {
      const left = Date.parse(expiresAt) - (Date.now() - clockOffset);
      setRemainingMs(left);
      if (left <= 0 && !submittedRef.current) {
        void doSubmit();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phase, expiresAt, clockOffset, doSubmit]);

  useEffect(() => {
    if (phase !== 'sitting') return;
    const id = window.setInterval(() => {
      void persist();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [phase, persist]);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function goTo(nextIndex: number) {
    await persist();
    setIndex(nextIndex);
  }

  if (phase === 'done') {
    return (
      <Stack gap="md" maw={density.contentMaxWidth} mx="auto" py={56} px="md" align="center">
        <Title order={1} ta="center" style={{ color: palette.ink }}>
          Thank you
        </Title>
        <Text ta="center" c="dimmed">
          Your answers are in. Our team will review them — you can close this page.
        </Text>
      </Stack>
    );
  }

  if (phase === 'intro') {
    return (
      <Stack gap="lg" maw={density.contentMaxWidth} mx="auto" py={56} px="md">
        <div>
          <Text size="sm" c="dimmed">
            {data.job_title}
          </Text>
          <Title order={1} style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing }}>
            {data.assessment.title}
          </Title>
          <Text mt="xs">Hi {data.candidate_name}.</Text>
        </div>
        <Text size="sm">
          Time limit: <strong>{data.assessment.duration_minutes} minutes</strong> once you start ·{' '}
          {data.assessment.question_count} question
          {data.assessment.question_count === 1 ? '' : 's'}
        </Text>
        <Text size="sm" c="dimmed">
          Start before {datetime(data.invite_deadline)}. The clock starts when you press Start.
        </Text>
        {data.assessment.instructions ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {data.assessment.instructions}
          </Text>
        ) : null}
        {error ? (
          <Alert color="danger" title="Could not start">
            {error}
          </Alert>
        ) : null}
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label="Start assessment"
          color="accent"
          loading={starting}
          onClick={() => void handleStart()}
        >
          Start
        </MotionButton>
      </Stack>
    );
  }

  const current: CandidateQuestion | undefined = questions[index];
  const isLast = index >= questions.length - 1;

  return (
    <div style={{ minHeight: '100vh', background: palette.paper }}>
      <Group
        justify="space-between"
        align="center"
        px="md"
        py="sm"
        style={{
          borderBottom: `1px solid ${palette.ink}14`,
          background: palette.paper,
          position: 'sticky',
          top: 0,
          zIndex: 5,
        }}
      >
        <Text size="sm" fw={600}>
          {data.assessment.title}
        </Text>
        <Group gap="md">
          <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {index + 1} of {questions.length}
          </Text>
          <Text size="sm" c="dimmed">
            {saving ? 'Saving…' : savedAt ? 'Saved' : ''}
          </Text>
          <Text
            size="sm"
            fw={700}
            style={{
              color:
                remainingMs != null && remainingMs < 60_000 ? palette.danger : palette.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {remainingMs == null ? '—' : formatRemaining(remainingMs)}
          </Text>
        </Group>
      </Group>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '32px 16px 48px',
        }}
      >
        <Group align="flex-start" gap="lg" wrap="nowrap" maw={density.contentMaxWidth + 180}>
          <Stack
            gap={4}
            p="sm"
            style={{
              width: 148,
              flexShrink: 0,
            }}
          >
            <Text size="xs" c="dimmed" mb={4}>
              Questions
            </Text>
            {questions.map((q, i) => {
              const answered = isAnswered(answers[q.id]);
              const active = i === index;
              return (
                <UnstyledButton
                  key={q.id}
                  className="cursor-pointer rounded-lg"
                  aria-label={`Go to question ${i + 1}${answered ? ', answered' : ', not answered'}`}
                  onClick={() => void goTo(i)}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'left',
                    background: active ? `${palette.accent}18` : 'transparent',
                    color: answered ? palette.success : palette.ink,
                    fontSize: 13,
                  }}
                >
                  {i + 1}. {answered ? 'Answered' : 'Not answered'}
                </UnstyledButton>
              );
            })}
          </Stack>

          <Paper
            withBorder
            radius={density.defaultRadius}
            style={{
              flex: 1,
              width: density.contentMaxWidth,
              maxWidth: density.contentMaxWidth,
              minHeight: QUESTION_CARD_MIN_HEIGHT,
              borderColor: `${palette.ink}14`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack gap="md" p="lg" style={{ flex: 1 }}>
              {error ? (
                <Alert color="danger" title="Something went wrong">
                  {error}
                </Alert>
              ) : null}
              {current ? (
                <>
                  <Text fw={600} style={{ whiteSpace: 'pre-wrap' }}>
                    {current.prompt}
                  </Text>
                  <AssessmentQuestionInput
                    question={current}
                    value={answers[current.id]}
                    onChange={(next) => setAnswer(current.id, next)}
                  />
                </>
              ) : null}
            </Stack>

            <Group
              justify="space-between"
              px="lg"
              py="md"
              style={{
                borderTop: `1px solid ${palette.ink}14`,
                minHeight: NAV_BAR_HEIGHT,
              }}
            >
              <MotionButton
                className="cursor-pointer rounded-lg"
                aria-label="Previous question"
                variant="default"
                disabled={index === 0}
                onClick={() => void goTo(index - 1)}
              >
                Prev
              </MotionButton>
              {isLast ? (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Submit assessment"
                  color="success"
                  loading={submitting}
                  onClick={() => setConfirmOpen(true)}
                >
                  Submit
                </MotionButton>
              ) : (
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label="Next question"
                  color="accent"
                  onClick={() => void goTo(index + 1)}
                >
                  Next
                </MotionButton>
              )}
            </Group>
          </Paper>
        </Group>
      </div>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit assessment?"
        centered
      >
        <Stack gap="md">
          {unanswered.length > 0 ? (
            <Text size="sm">
              You have not answered:{' '}
              {unanswered
                .map((q) => {
                  const n = questions.findIndex((row) => row.id === q.id) + 1;
                  return `question ${n}`;
                })
                .join(', ')}
              . Submit anyway?
            </Text>
          ) : (
            <Text size="sm">All questions have an answer. Submit now?</Text>
          )}
          <Group justify="flex-end">
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Cancel submit"
              variant="default"
              onClick={() => setConfirmOpen(false)}
            >
              Back
            </MotionButton>
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Confirm submit assessment"
              color="success"
              loading={submitting}
              onClick={() => void doSubmit()}
            >
              Submit
            </MotionButton>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
