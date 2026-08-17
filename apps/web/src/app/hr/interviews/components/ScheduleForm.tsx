'use client';

import { useState } from 'react';
import { Group, Select, Stack, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import type { HrInterviewScheduleResult } from '@/types/api';

const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
];

export function ScheduleForm({
  applicationId,
  roundNo = 1,
  onScheduled,
}: {
  applicationId: string;
  roundNo?: number;
  onScheduled?: () => void;
}) {
  const defaultTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [timezone, setTimezone] = useState(defaultTz);
  const [duration, setDuration] = useState('45');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerEmail, setInterviewerEmail] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const tzOptions = Array.from(new Set([defaultTz, ...COMMON_TIMEZONES])).map((tz) => ({
    value: tz,
    label: tz,
  }));

  async function submit() {
    if (!scheduledAt) {
      toastError('Pick a date and time');
      return;
    }
    setSaving(true);
    try {
      await api<HrInterviewScheduleResult>(
        `/api/hr/candidates/${applicationId}/interview`,
        {
          method: 'POST',
          body: {
            round_no: roundNo,
            scheduled_at: scheduledAt.toISOString(),
            timezone,
            duration_minutes: Number(duration) || 45,
            interviewer_name: interviewerName || undefined,
            interviewer_email: interviewerEmail || undefined,
            meeting_url: meetingUrl || undefined,
          },
        },
      );
      toastSuccess('Interview scheduled');
      onScheduled?.();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      <DateTimePicker
        className="rounded outline-none"
        label="Scheduled at"
        aria-label="Interview date and time"
        value={scheduledAt}
        onChange={(value) => setScheduledAt(value ? new Date(value) : null)}
        minDate={new Date()}
      />
      <Select
        className="rounded outline-none"
        label="Timezone"
        aria-label="Interview timezone"
        data={tzOptions}
        value={timezone}
        onChange={(v) => setTimezone(v ?? defaultTz)}
        searchable
      />
      <TextInput
        className="rounded outline-none"
        label="Duration (minutes)"
        aria-label="Interview duration in minutes"
        value={duration}
        onChange={(e) => setDuration(e.currentTarget.value)}
      />
      <Group grow>
        <TextInput
          className="rounded outline-none"
          label="Interviewer name"
          aria-label="Interviewer name"
          value={interviewerName}
          onChange={(e) => setInterviewerName(e.currentTarget.value)}
        />
        <TextInput
          className="rounded outline-none"
          label="Interviewer email"
          aria-label="Interviewer email"
          value={interviewerEmail}
          onChange={(e) => setInterviewerEmail(e.currentTarget.value)}
        />
      </Group>
      <TextInput
        className="rounded outline-none"
        label="Meeting URL"
        aria-label="Meeting URL"
        value={meetingUrl}
        onChange={(e) => setMeetingUrl(e.currentTarget.value)}
      />
      <MotionButton
        className="cursor-pointer rounded-lg"
        aria-label="Save interview schedule"
        color="accent"
        loading={saving}
        onClick={() => void submit()}
      >
        Schedule interview
      </MotionButton>
    </Stack>
  );
}
