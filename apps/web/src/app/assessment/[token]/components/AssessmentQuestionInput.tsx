'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Extension } from '@codemirror/state';
import { Radio, Stack, Textarea } from '@mantine/core';
import { density, palette } from '@/theme';
import type { CandidateQuestion } from '@/types/api';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

function CodeAnswer({
  value,
  language,
  onChange,
}: {
  value: string;
  language: string | null;
  onChange: (next: string) => void;
}) {
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
        height="240px"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true }}
      />
    </div>
  );
}

function answerAsString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: unknown }).text ?? '');
  }
  if (typeof value === 'object' && value !== null && 'key' in value) {
    return String((value as { key: unknown }).key ?? '');
  }
  return String(value);
}

function mcqOptions(options: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(options)) return [];
  return options.map((item, index) => {
    if (typeof item === 'string') {
      return { key: String.fromCharCode(97 + index), text: item };
    }
    if (item && typeof item === 'object') {
      const row = item as { key?: unknown; text?: unknown };
      return {
        key: typeof row.key === 'string' ? row.key : String.fromCharCode(97 + index),
        text: typeof row.text === 'string' ? row.text : String(row.text ?? ''),
      };
    }
    return { key: String.fromCharCode(97 + index), text: String(item) };
  });
}

export function AssessmentQuestionInput({
  question,
  value,
  onChange,
  onPasteDetected,
}: {
  question: CandidateQuestion;
  value: unknown;
  onChange: (next: unknown) => void;
  onPasteDetected?: (charCount?: number) => void;
}) {
  if (question.type === 'MCQ') {
    const options = mcqOptions(question.options);
    const current = answerAsString(value);
    return (
      <Radio.Group
        label="Your answer"
        value={current}
        onChange={(key) => onChange({ key })}
        aria-label="Multiple choice answer"
      >
        <Stack gap="xs" mt="xs">
          {options.map((opt) => (
            <Radio
              key={opt.key}
              value={opt.key}
              label={opt.text}
              className="rounded outline-none"
            />
          ))}
        </Stack>
      </Radio.Group>
    );
  }

  if (question.type === 'CODING' || question.type === 'SQL') {
    return (
      <Stack
        gap="xs"
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          onPasteDetected?.(text.length);
        }}
      >
        <span style={{ fontSize: density.bodyFontSize, color: palette.ink }}>Your answer</span>
        <CodeAnswer
          value={answerAsString(value)}
          language={question.language}
          onChange={(text) => onChange({ text })}
        />
      </Stack>
    );
  }

  return (
    <Textarea
      className="rounded outline-none"
      label="Your answer"
      aria-label="Written answer"
      autosize
      minRows={6}
      value={answerAsString(value)}
      onChange={(e) => onChange({ text: e.currentTarget.value })}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text');
        onPasteDetected?.(text.length);
      }}
    />
  );
}

export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'object') {
    const row = value as { text?: unknown; key?: unknown };
    if (typeof row.text === 'string') return row.text.trim() !== '';
    if (typeof row.key === 'string') return row.key.trim() !== '';
  }
  return true;
}
