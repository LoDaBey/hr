'use client';

import {
  Button,
  Group,
  NumberInput,
  Paper,
  Radio,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { CheckboxReveal } from '@/components/hr/job-editor/CheckboxReveal';
import { density, palette } from '@/theme';
import type { AssessmentDraft, AssessmentQuestionDraft } from '@/types/job-editor';
import {
  ASSESSMENT_QUESTION_TYPE_OPTIONS,
  CODING_LANGUAGE_OPTIONS,
} from '@/types/job-editor';
import type { AssessmentKind, AssessmentQuestion, QuestionType } from '@/types/domain';

function draftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `aq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyAssessmentQuestion(): AssessmentQuestionDraft {
  return {
    draftId: draftId(),
    type: 'TEXT',
    prompt: '',
    max_score: 10,
    rubric: '',
    options: ['', ''],
    correct_index: null,
    language: null,
  };
}

export function createEmptyAssessmentDraft(kind: AssessmentKind = 'ASSESSMENT'): AssessmentDraft {
  const isTech = kind === 'TECH_TEST';
  return {
    title: '',
    instructions: '',
    duration_minutes: isTech ? 20 : 45,
    pass_score: 60,
    questions: [],
    require_camera: isTech,
    require_mic: isTech,
    require_fullscreen: isTech,
    rules: '',
  };
}

function parseMcqOptions(value: unknown): { options: string[] } {
  if (!Array.isArray(value)) return { options: ['', ''] };
  const options: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      options.push(item);
      continue;
    }
    if (item && typeof item === 'object') {
      const row = item as { text?: unknown };
      options.push(typeof row.text === 'string' ? row.text : String(row.text ?? ''));
    }
  }
  return { options: options.length > 0 ? options : ['', ''] };
}

export function assessmentDraftFromDetail(detail: {
  title: string;
  instructions: string | null;
  duration_minutes: number;
  pass_score: number;
  require_camera?: boolean;
  require_mic?: boolean;
  require_fullscreen?: boolean;
  rules?: string | null;
  questions: AssessmentQuestion[];
}): AssessmentDraft {
  return {
    title: detail.title,
    instructions: detail.instructions ?? '',
    duration_minutes: detail.duration_minutes,
    pass_score: detail.pass_score,
    require_camera: detail.require_camera ?? false,
    require_mic: detail.require_mic ?? false,
    require_fullscreen: detail.require_fullscreen ?? false,
    rules: detail.rules ?? '',
    questions: detail.questions.map((q) => {
      const parsed = parseMcqOptions(q.options);
      let correct_index: number | null = null;
      if (q.type === 'MCQ' && q.correct_key && Array.isArray(q.options)) {
        const idx = q.options.findIndex((item) => {
          if (!item || typeof item !== 'object') return false;
          return (item as { key?: string }).key === q.correct_key;
        });
        correct_index = idx >= 0 ? idx : null;
      }
      return {
        draftId: draftId(),
        type: q.type,
        prompt: q.prompt,
        max_score: q.max_score,
        rubric: q.rubric ?? '',
        options: parsed.options,
        correct_index,
        language: q.language,
      };
    }),
  };
}

export function optionKeyAt(index: number): string {
  return String.fromCharCode(97 + index);
}

export function serializeAssessmentQuestions(questions: AssessmentQuestionDraft[]) {
  return questions.map((q) => {
    const base = {
      type: q.type,
      prompt: q.prompt.trim(),
      max_score: Math.max(1, Number(q.max_score) || 10),
      rubric: q.rubric.trim() || undefined,
      language: q.type === 'CODING' || q.type === 'SQL' ? q.language : null,
    };
    if (q.type !== 'MCQ') {
      return { ...base, options: [] };
    }
    const filled = q.options
      .map((text, index) => ({ text: text.trim(), index }))
      .filter((row) => row.text.length > 0);
    const options = filled.map((row, index) => ({
      key: optionKeyAt(index),
      text: row.text,
    }));
    const correctPos = filled.findIndex((row) => row.index === q.correct_index);
    return {
      ...base,
      options,
      correct_key: correctPos >= 0 ? options[correctPos]?.key : undefined,
    };
  });
}

export function AssessmentSection({
  kind = 'ASSESSMENT',
  value,
  onChange,
  onDirty,
}: {
  kind?: AssessmentKind;
  value: AssessmentDraft;
  onChange: (next: AssessmentDraft) => void;
  onDirty: () => void;
}) {
  const isTechTest = kind === 'TECH_TEST';

  function update(patch: Partial<AssessmentDraft>) {
    onChange({ ...value, ...patch });
    onDirty();
  }

  function updateQuestion(index: number, patch: Partial<AssessmentQuestionDraft>) {
    const questions = [...value.questions];
    questions[index] = { ...questions[index]!, ...patch };
    update({ questions });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.questions.length) return;
    const questions = [...value.questions];
    const [row] = questions.splice(index, 1);
    questions.splice(target, 0, row!);
    update({ questions });
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {isTechTest
          ? 'Optional. Sent after a technical shortlist. The session is recorded.'
          : 'Optional. Candidates only see this after you shortlist them at screening.'}
      </Text>

      <TextInput
        className="rounded outline-none"
        label="Title"
        aria-label={isTechTest ? 'Tech test title' : 'Assessment title'}
        placeholder={isTechTest ? 'Recorded technical interview' : 'Technical assessment'}
        value={value.title}
        onChange={(e) => update({ title: e.currentTarget.value })}
      />
      <Textarea
        className="rounded outline-none"
        label="Instructions"
        aria-label={isTechTest ? 'Tech test instructions' : 'Assessment instructions'}
        minRows={3}
        value={value.instructions}
        onChange={(e) => update({ instructions: e.currentTarget.value })}
      />
      <Group grow>
        <NumberInput
          className="rounded outline-none"
          label="Time limit (minutes)"
          aria-label={isTechTest ? 'Tech test time limit in minutes' : 'Assessment time limit in minutes'}
          min={5}
          value={value.duration_minutes}
          onChange={(v) =>
            update({ duration_minutes: v === '' ? (isTechTest ? 20 : 45) : v })
          }
        />
        <NumberInput
          className="rounded outline-none"
          label="Pass score (%)"
          aria-label={isTechTest ? 'Tech test pass score percent' : 'Assessment pass score percent'}
          min={0}
          max={100}
          value={value.pass_score}
          onChange={(v) => update({ pass_score: v === '' ? 60 : v })}
        />
      </Group>

      {isTechTest ? (
        <Stack gap="sm">
          <CheckboxReveal
            label="Require camera"
            description="Candidate must allow camera access before starting."
            checked={value.require_camera}
            onCheckedChange={(checked) => update({ require_camera: checked })}
          />
          <CheckboxReveal
            label="Require microphone"
            description="Candidate must allow microphone access before starting."
            checked={value.require_mic}
            onCheckedChange={(checked) => update({ require_mic: checked })}
          />
          <CheckboxReveal
            label="Require fullscreen"
            description="Session starts in fullscreen. Leaving it is flagged."
            checked={value.require_fullscreen}
            onCheckedChange={(checked) => update({ require_fullscreen: checked })}
          />
          <Textarea
            className="rounded outline-none"
            label="Rules"
            description="Shown to the candidate before they start. One rule per line."
            aria-label="Tech test rules for the candidate"
            minRows={4}
            placeholder={'Stay in fullscreen for the whole session\nDo not switch tabs\nKeep your camera and microphone on'}
            value={value.rules}
            onChange={(e) => update({ rules: e.currentTarget.value })}
          />
        </Stack>
      ) : null}

      <Group justify="flex-end">
        <MotionButton
          className="cursor-pointer rounded-lg"
          aria-label={isTechTest ? 'Add tech test question' : 'Add assessment question'}
          variant="default"
          onClick={() =>
            update({ questions: [...value.questions, createEmptyAssessmentQuestion()] })
          }
        >
          Add question
        </MotionButton>
      </Group>

      {value.questions.length === 0 ? (
        <Text size="sm" c="dimmed">
          No questions yet. Add an MCQ, written answer, coding, or scenario question.
        </Text>
      ) : null}

      {value.questions.map((q, index) => (
        <Paper
          key={q.draftId}
          withBorder
          p="md"
          radius={density.defaultRadius}
          style={{ borderColor: `${palette.ink}14` }}
        >
          <Stack gap="xs">
            <Group grow align="flex-end">
              <Select
                className="rounded outline-none"
                label="Type"
                aria-label={`Assessment question type ${index + 1}`}
                data={ASSESSMENT_QUESTION_TYPE_OPTIONS}
                value={q.type}
                onChange={(next) => {
                  if (!next) return;
                  const type = next as QuestionType;
                  updateQuestion(index, {
                    type,
                    language:
                      type === 'CODING' ? q.language || 'javascript' : type === 'SQL' ? 'sql' : null,
                    options: type === 'MCQ' ? (q.options.length >= 2 ? q.options : ['', '']) : q.options,
                  });
                }}
              />
              <NumberInput
                className="rounded outline-none"
                label="Points"
                aria-label={`Assessment question points ${index + 1}`}
                min={1}
                value={q.max_score}
                onChange={(v) => updateQuestion(index, { max_score: v === '' ? 10 : v })}
              />
            </Group>

            <Textarea
              className="rounded outline-none"
              label="Question"
              aria-label={`Assessment question prompt ${index + 1}`}
              minRows={2}
              value={q.prompt}
              onChange={(e) => updateQuestion(index, { prompt: e.currentTarget.value })}
            />

            <Textarea
              className="rounded outline-none"
              label="What a good answer covers"
              description="Only the reviewer and the grader see this. Never shown to the candidate."
              aria-label={`Assessment question rubric ${index + 1}`}
              minRows={2}
              value={q.rubric}
              onChange={(e) => updateQuestion(index, { rubric: e.currentTarget.value })}
            />

            {q.type === 'MCQ' ? (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Options
                </Text>
                <Radio.Group
                  value={q.correct_index == null ? '' : String(q.correct_index)}
                  onChange={(v) =>
                    updateQuestion(index, { correct_index: v === '' ? null : Number(v) })
                  }
                  label="Correct answer"
                  aria-label={`Correct answer for question ${index + 1}`}
                >
                  <Stack gap="xs" mt="xs">
                    {q.options.map((opt, optIndex) => (
                      <Group key={`${q.draftId}-opt-${optIndex}`} wrap="nowrap" align="center">
                        <Radio value={String(optIndex)} aria-label={`Mark option ${optIndex + 1} correct`} />
                        <TextInput
                          className="rounded outline-none"
                          style={{ flex: 1 }}
                          aria-label={`Option ${optIndex + 1} for question ${index + 1}`}
                          placeholder={`Option ${optIndex + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const options = [...q.options];
                            options[optIndex] = e.currentTarget.value;
                            updateQuestion(index, { options });
                          }}
                        />
                        <Button
                          className="cursor-pointer rounded-lg"
                          aria-label={`Remove option ${optIndex + 1}`}
                          variant="subtle"
                          color="danger"
                          size="compact-sm"
                          disabled={q.options.length <= 2}
                          onClick={() => {
                            const options = q.options.filter((_, i) => i !== optIndex);
                            let correct_index = q.correct_index;
                            if (correct_index === optIndex) correct_index = null;
                            else if (correct_index != null && correct_index > optIndex) {
                              correct_index -= 1;
                            }
                            updateQuestion(index, { options, correct_index });
                          }}
                        >
                          Remove
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                </Radio.Group>
                <MotionButton
                  className="cursor-pointer rounded-lg"
                  aria-label={`Add option to question ${index + 1}`}
                  variant="subtle"
                  size="xs"
                  onClick={() => updateQuestion(index, { options: [...q.options, ''] })}
                >
                  Add option
                </MotionButton>
              </Stack>
            ) : null}

            {q.type === 'CODING' || q.type === 'SQL' ? (
              <Select
                className="rounded outline-none"
                label="Language"
                aria-label={`Language for question ${index + 1}`}
                data={CODING_LANGUAGE_OPTIONS}
                value={q.language}
                onChange={(next) => updateQuestion(index, { language: next })}
              />
            ) : null}

            <Group>
              <Button
                className="cursor-pointer rounded-lg"
                aria-label={`Move assessment question ${index + 1} up`}
                variant="subtle"
                size="compact-sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                Up
              </Button>
              <Button
                className="cursor-pointer rounded-lg"
                aria-label={`Move assessment question ${index + 1} down`}
                variant="subtle"
                size="compact-sm"
                disabled={index === value.questions.length - 1}
                onClick={() => move(index, 1)}
              >
                Down
              </Button>
              <Button
                className="cursor-pointer rounded-lg"
                aria-label={`Remove assessment question ${index + 1}`}
                variant="subtle"
                color="danger"
                size="compact-sm"
                onClick={() =>
                  update({ questions: value.questions.filter((_, i) => i !== index) })
                }
              >
                Remove
              </Button>
            </Group>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
