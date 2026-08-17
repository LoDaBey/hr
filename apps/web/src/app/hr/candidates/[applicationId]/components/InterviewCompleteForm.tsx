'use client';

import { useState } from 'react';
import { NumberInput, Stack, TextInput, Textarea } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import type { HrInterviewCompleteResult } from '@/types/api';

export function InterviewCompleteForm({
  interviewId,
  onCompleted,
}: {
  interviewId: string;
  onCompleted?: () => void;
}) {
  const [score, setScore] = useState<number | string>(7);
  const [notes, setNotes] = useState('');
  const [salary, setSalary] = useState<number | string>('');
  const [availability, setAvailability] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api<HrInterviewCompleteResult>(`/api/hr/interviews/${interviewId}`, {
        method: 'PATCH',
        body: {
          score: typeof score === 'number' ? score : Number(score) || undefined,
          notes: notes || undefined,
          salary_discussed:
            salary === '' ? undefined : typeof salary === 'number' ? salary : Number(salary),
          availability_note: availability || undefined,
          recommendation: recommendation || undefined,
        },
      });
      toastSuccess('Interview marked complete');
      onCompleted?.();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not complete interview');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      <NumberInput
        className="rounded outline-none"
        label="Score (1–10)"
        aria-label="Interview score from 1 to 10"
        min={1}
        max={10}
        value={score}
        onChange={setScore}
      />
      <Textarea
        className="rounded outline-none"
        label="Notes"
        aria-label="Interview notes"
        minRows={3}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <NumberInput
        className="rounded outline-none"
        label="Salary discussed"
        aria-label="Salary discussed"
        value={salary}
        onChange={setSalary}
        min={0}
      />
      <TextInput
        className="rounded outline-none"
        label="Availability"
        aria-label="Availability note"
        value={availability}
        onChange={(e) => setAvailability(e.currentTarget.value)}
      />
      <TextInput
        className="rounded outline-none"
        label="Recommendation"
        aria-label="Recommendation"
        value={recommendation}
        onChange={(e) => setRecommendation(e.currentTarget.value)}
      />
      <MotionButton
        className="cursor-pointer rounded-lg"
        aria-label="Mark interview complete"
        color="accent"
        loading={saving}
        onClick={() => void submit()}
      >
        Mark complete
      </MotionButton>
    </Stack>
  );
}
