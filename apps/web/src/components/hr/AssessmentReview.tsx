'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Extension } from '@codemirror/state';
import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { density, palette } from '@/theme';
import type { QuestionType } from '@/types/domain';

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
  late: boolean;
  ai_score: number | null;
  ai_max_score: number | null;
  submitted_at: string | null;
  overall_feedback: string | null;
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

export function AssessmentReview({ review }: { review: AssessmentReviewData }) {
  const totalScore = review.questions.reduce(
    (s, q) => s + (q.evaluation?.score ?? 0),
    0,
  );
  const totalMax = review.questions.reduce(
    (s, q) => s + (q.evaluation?.max_score ?? q.max_score ?? 0),
    0,
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="sm">
          <Text fw={600}>
            Score: {review.ai_score ?? Math.round(totalMax ? (totalScore / totalMax) * 100 : 0)}
            {review.ai_max_score ? ` / ${review.ai_max_score}` : '%'}
          </Text>
          <Text size="sm" c="dimmed">
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
              ) : (
                <Text size="sm" c="dimmed">
                  No evaluation yet.
                </Text>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
