'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Extension } from '@codemirror/state';
import { Alert, Badge, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { ScoreDisplay } from '@/components/ui/ScoreDisplay';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { density, palette } from '@/theme';
import type { HrGradeNowResult } from '@/types/api';
import type { QuestionType, SittingStatus } from '@/types/domain';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

export type AssessmentReviewQuestion = {
  id: string;
  order_index: number;
  type: QuestionType;
  prompt: string;
  options: unknown;
  language: string | null;
  max_score: number;
  answer: unknown;
  evaluation: {
    score: number | null;
    max_score: number | null;
    correct_concepts: unknown;
    missing_concepts: unknown;
    technical_errors: unknown;
    feedback: string | null;
    confidence: number | null;
  } | null;
};

export type AssessmentReviewData = {
  id: string;
  status: SittingStatus;
  late: boolean;
  ai_score: number | null;
  ai_max_score: number | null;
  submitted_at: string | null;
  overall_feedback: string | null;
  has_overall_evaluation: boolean;
  grading_error: string | null;
  questions: AssessmentReviewQuestion[];
};

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
}

function answerDisplay(answer: unknown, type: QuestionType): string {
  if (answer == null) return '—';
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'object') {
    const row = answer as { text?: unknown; key?: unknown };
    if (typeof row.text === 'string') return row.text;
    if (typeof row.key === 'string') {
      if (type === 'MCQ') return `Option ${row.key}`;
      return row.key;
    }
  }
  return JSON.stringify(answer);
}

function ReadOnlyCode({ value, language }: { value: string; language: string | null }) {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (language === 'sql' || language === 'SQL') {
        const mod = await import('@codemirror/lang-sql');
        if (!cancelled) setExtensions([mod.sql()]);
      } else {
        const mod = await import('@codemirror/lang-javascript');
        if (!cancelled) setExtensions([mod.javascript()]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <div
      style={{
        border: `1px solid ${palette.ink}22`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <CodeMirror
        value={value}
        height="180px"
        editable={false}
        extensions={extensions}
        basicSetup={{ lineNumbers: true }}
      />
    </div>
  );
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;
  return Math.floor((Date.now() - at) / 60_000);
}

function ScoreHeader({
  review,
  applicationId,
  gradeKind,
  onGraded,
}: {
  review: AssessmentReviewData;
  applicationId?: string;
  gradeKind?: 'ASSESSMENT' | 'TECH_TEST';
  onGraded?: () => void;
}) {
  const [grading, setGrading] = useState(false);
  const awaitingGrading =
    !review.grading_error && !review.has_overall_evaluation && review.status === 'SUBMITTED';
  const minutesWaiting = minutesSince(review.submitted_at);
  const showGradeNow =
    awaitingGrading &&
    applicationId &&
    gradeKind &&
    minutesWaiting != null &&
    minutesWaiting >= 5;

  async function gradeNow() {
    if (!applicationId || !gradeKind) return;
    setGrading(true);
    try {
      const path =
        gradeKind === 'TECH_TEST'
          ? `/api/hr/candidates/${applicationId}/techtest/grade-now`
          : `/api/hr/candidates/${applicationId}/assessment/grade-now`;
      await api<HrGradeNowResult>(path, { method: 'POST' });
      toastSuccess('Grading complete');
      onGraded?.();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Grade now failed');
    } finally {
      setGrading(false);
    }
  }

  if (review.grading_error && !review.has_overall_evaluation) {
    return (
      <Alert color="danger" title="Grading failed — review manually">
        {review.grading_error}
      </Alert>
    );
  }

  if (!review.has_overall_evaluation && review.status === 'SUBMITTED') {
    return (
      <Stack gap="sm">
        <Group gap="sm">
          <Loader size="sm" color="accent" aria-label="Awaiting grading" />
          <Text fw={600} style={{ color: palette.ink }}>
            Awaiting grading
          </Text>
          <Text size="sm" c="dimmed">
            AI grading is in progress — this page refreshes automatically.
          </Text>
        </Group>
        {showGradeNow ? (
          <Group gap="sm">
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Grade submission now"
              color="warning"
              loading={grading}
              disabled={grading}
              onClick={() => void gradeNow()}
            >
              Grade now
            </MotionButton>
            <Text size="sm" c="dimmed">
              Submitted {minutesWaiting} minutes ago — use if grading is stuck.
            </Text>
          </Group>
        ) : null}
      </Stack>
    );
  }

  if (!review.has_overall_evaluation) {
    return (
      <Text fw={600} c="dimmed">
        Not graded yet
      </Text>
    );
  }

  const totalScore = review.questions.reduce((s, q) => s + (q.evaluation?.score ?? 0), 0);
  const totalMax = review.questions.reduce(
    (s, q) => s + (q.evaluation?.max_score ?? q.max_score ?? 0),
    0,
  );

  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Group gap="md" align="flex-end" wrap="wrap">
        <ScoreDisplay
          score={review.ai_score ?? Math.round(totalMax ? (totalScore / totalMax) * 100 : 0)}
          max={review.ai_max_score ?? 100}
          label="Assessment score"
        />
        <Text size="sm" c="dimmed" pb={4}>
          ({totalScore} / {totalMax} points)
        </Text>
        {review.late ? (
          <Badge color="warning" variant="light">
            Late
          </Badge>
        ) : null}
      </Group>
      {review.overall_feedback ? (
        <Text size="sm" c="dimmed" maw={420}>
          {review.overall_feedback}
        </Text>
      ) : null}
    </Group>
  );
}

export function AssessmentReview({
  review,
  applicationId,
  gradeKind,
  onGraded,
}: {
  review: AssessmentReviewData;
  applicationId?: string;
  gradeKind?: 'ASSESSMENT' | 'TECH_TEST';
  onGraded?: () => void;
}) {
  return (
    <Stack gap="md">
      <ScoreHeader
        review={review}
        applicationId={applicationId}
        gradeKind={gradeKind}
        onGraded={onGraded}
      />

      {review.questions.map((q, index) => {
        const ev = q.evaluation;
        const text = answerDisplay(q.answer, q.type);
        const isCode = q.type === 'CODING' || q.type === 'SQL';

        return (
          <Paper
            key={q.id}
            withBorder
            p="md"
            radius={density.defaultRadius}
            style={{ borderColor: `${palette.ink}14` }}
          >
            <Stack gap="sm">
              <Title order={4}>
                Question {index + 1}
                <Text span size="sm" c="dimmed" fw={400}>
                  {' '}
                  · {q.type} · {q.max_score} pts
                </Text>
              </Title>
              <Text style={{ whiteSpace: 'pre-wrap' }}>{q.prompt}</Text>

              <Text size="sm" fw={600}>
                Candidate answer
              </Text>
              {isCode ? (
                <ReadOnlyCode value={text === '—' ? '' : text} language={q.language} />
              ) : (
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c={text === '—' ? 'dimmed' : undefined}>
                  {text}
                </Text>
              )}

              {ev ? (
                <Stack gap={4}>
                  <Text size="sm" fw={600}>
                    Evaluation: {ev.score ?? 0} / {ev.max_score ?? q.max_score}
                    {ev.confidence != null ? ` · confidence ${ev.confidence}` : ''}
                  </Text>
                  {ev.feedback ? <Text size="sm">{ev.feedback}</Text> : null}
                  {asList(ev.correct_concepts).length > 0 ? (
                    <Text size="sm" c="dimmed">
                      Covered: {asList(ev.correct_concepts).join('; ')}
                    </Text>
                  ) : null}
                  {asList(ev.missing_concepts).length > 0 ? (
                    <Text size="sm" c="dimmed">
                      Missed: {asList(ev.missing_concepts).join('; ')}
                    </Text>
                  ) : null}
                  {asList(ev.technical_errors).length > 0 ? (
                    <Text size="sm" c="dimmed">
                      Errors: {asList(ev.technical_errors).join('; ')}
                    </Text>
                  ) : null}
                </Stack>
              ) : review.has_overall_evaluation ? (
                <Text size="sm" c="dimmed">
                  No evaluation yet.
                </Text>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
