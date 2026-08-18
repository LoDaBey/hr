'use client';

import { useState } from 'react';
import {
  Button,
  Checkbox,
  Divider,
  Group,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { JOB_QUESTION_TYPE, labelOf } from '@/lib/labels';
import {
  loadQuestionLibrary,
  rememberQuestions,
  removeSavedQuestion,
  templateToDraft,
} from '@/lib/question-library';
import type { QuestionDraft, SavedQuestionTemplate } from '@/types/job-editor';
import { QUESTION_TYPE_OPTIONS } from '@/types/job-editor';
import type { JobQuestionType } from '@/types/domain';

function newDraftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyQuestion(): QuestionDraft {
  return {
    draftId: newDraftId(),
    key: '',
    label: '',
    type: 'TEXT',
    is_required: true,
    options: [],
  };
}

export function QuestionsSection({
  questions,
  onChange,
  onDirty,
}: {
  questions: QuestionDraft[];
  onChange: (rows: QuestionDraft[]) => void;
  onDirty: () => void;
}) {
  const [library, setLibrary] = useState<SavedQuestionTemplate[]>(() => loadQuestionLibrary());
  const [pickId, setPickId] = useState<string | null>(null);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next);
    onDirty();
  }

  function addBlank() {
    onChange([...questions, createEmptyQuestion()]);
    onDirty();
  }

  function addFromLibrary() {
    if (!pickId) return;
    const template = library.find((row) => row.id === pickId);
    if (!template) return;
    onChange([...questions, templateToDraft(template)]);
    onDirty();
    setPickId(null);
  }

  function persistCurrent() {
    const next = rememberQuestions(questions);
    setLibrary(next);
  }

  const libraryOptions = library.map((row) => ({
    value: row.id,
    label: `${row.label} (${labelOf(JOB_QUESTION_TYPE, row.type)})`,
  }));

  return (
    <Stack gap="md">
      <Group align="flex-end" wrap="wrap" justify="space-between">
        {library.length > 0 ? (
          <Group align="flex-end" wrap="wrap" style={{ flex: 1, minWidth: 240 }}>
            <Select
              className="rounded outline-none"
              label="Reuse a saved question"
              aria-label="Pick a saved question"
              placeholder="Choose a question"
              data={libraryOptions}
              value={pickId}
              onChange={setPickId}
              searchable
              clearable
              style={{ flex: 1, minWidth: 220 }}
            />
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Add selected saved question"
              variant="default"
              disabled={!pickId}
              onClick={addFromLibrary}
            >
              Add saved
            </MotionButton>
            {pickId ? (
              <Button
                className="cursor-pointer rounded-lg"
                aria-label="Remove saved question from library"
                variant="subtle"
                color="danger"
                onClick={() => {
                  setLibrary(removeSavedQuestion(pickId));
                  setPickId(null);
                }}
              >
                Forget
              </Button>
            ) : null}
          </Group>
        ) : (
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>
            Saved questions appear here after you add labels and save to the library.
          </Text>
        )}
        <Group gap="sm" wrap="wrap">
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Save current questions to library"
            variant="subtle"
            disabled={questions.every((q) => !q.label.trim())}
            onClick={persistCurrent}
          >
            Save to library
          </MotionButton>
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label="Add application question"
            variant="default"
            onClick={addBlank}
          >
            Add question
          </MotionButton>
        </Group>
      </Group>

      {questions.length === 0 ? (
        <Text size="sm" c="dimmed">
          Add at least one question. Screening rules unlock once questions exist.
        </Text>
      ) : null}

      {questions.map((q, index) => (
        <Stack key={q.draftId} gap="xs">
          {index > 0 ? <Divider /> : null}
          <Group grow align="flex-end">
            <TextInput
              className="rounded outline-none"
              label="Label"
              aria-label={`Question label ${index + 1}`}
              required
              value={q.label}
              onChange={(e) => {
                const next = [...questions];
                next[index] = { ...q, label: e.currentTarget.value };
                onChange(next);
                onDirty();
              }}
            />
            <Select
              className="rounded outline-none"
              label="Type"
              aria-label={`Question type ${index + 1}`}
              data={QUESTION_TYPE_OPTIONS}
              value={q.type}
              onChange={(value) => {
                if (!value) return;
                const next = [...questions];
                next[index] = { ...q, type: value as JobQuestionType };
                onChange(next);
                onDirty();
              }}
            />
          </Group>
          {(q.type === 'SELECT' || q.type === 'MULTISELECT') && (
            <TagsInput
              className="rounded outline-none"
              label="Options"
              aria-label={`Question options ${index + 1}`}
              placeholder="Type an option and press Enter"
              value={q.options}
              onChange={(value) => {
                const next = [...questions];
                next[index] = { ...q, options: value };
                onChange(next);
                onDirty();
              }}
            />
          )}
          <Group>
            <Checkbox
              label="Required"
              aria-label={`Question required ${index + 1}`}
              checked={q.is_required}
              onChange={(e) => {
                const next = [...questions];
                next[index] = { ...q, is_required: e.currentTarget.checked };
                onChange(next);
                onDirty();
              }}
            />
            <Button
              className="cursor-pointer rounded-lg"
              aria-label={`Move question ${index + 1} up`}
              variant="subtle"
              size="compact-sm"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              Up
            </Button>
            <Button
              className="cursor-pointer rounded-lg"
              aria-label={`Move question ${index + 1} down`}
              variant="subtle"
              size="compact-sm"
              disabled={index === questions.length - 1}
              onClick={() => move(index, 1)}
            >
              Down
            </Button>
            <Button
              className="cursor-pointer rounded-lg"
              aria-label={`Remove question ${index + 1}`}
              variant="subtle"
              color="danger"
              size="compact-sm"
              onClick={() => {
                onChange(questions.filter((_, i) => i !== index));
                onDirty();
              }}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      ))}
    </Stack>
  );
}
