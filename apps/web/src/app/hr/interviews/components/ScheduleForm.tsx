'use client';

import { useState } from 'react';
import { ActionIcon, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconPencil } from '@tabler/icons-react';
import { MotionButton } from '@/components/MotionButton';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import type { HrInterviewScheduleResult } from '@/types/api';
import type { Interview } from '@/types/domain';

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
  existing,
  onScheduled,
}: {
  applicationId: string;
  roundNo?: number;
  /** When set and SCHEDULED, form is read-only until Edit is pressed. */
  existing?: Interview | null;
  onScheduled?: () => void;
}) {
  const defaultTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

  const hasScheduled =
    Boolean(existing) &&
    existing!.status === 'SCHEDULED' &&
    Boolean(existing!.scheduled_at);

  const [editing, setEditing] = useState(!hasScheduled);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(() =>
    existing?.scheduled_at ? new Date(existing.scheduled_at) : null,
  );
  const [timezone, setTimezone] = useState(existing?.timezone || defaultTz);
  const [duration, setDuration] = useState(String(existing?.duration_minutes ?? 45));
  const [interviewerName, setInterviewerName] = useState(existing?.interviewer_name ?? '');
  const [interviewerEmail, setInterviewerEmail] = useState(existing?.interviewer_email ?? '');
  const [meetingUrl, setMeetingUrl] = useState(existing?.meeting_url ?? '');
  const [saving, setSaving] = useState(false);

  const readOnly = hasScheduled && !editing;

  const tzOptions = Array.from(
    new Set([timezone, defaultTz, ...COMMON_TIMEZONES].filter(Boolean)),
  ).map((tz) => ({
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
      toastSuccess(hasScheduled ? 'Interview updated' : 'Interview scheduled');
      setEditing(false);
      onScheduled?.();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      {hasScheduled ? (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {readOnly
              ? 'Interview already scheduled. Open Edit to change details.'
              : 'Editing schedule — save to update (does not create a duplicate).'}
          </Text>
          {readOnly ? (
            <Tooltip label="Edit interview">
              <ActionIcon
                className="cursor-pointer rounded-lg"
                aria-label="Edit scheduled interview"
                variant="light"
                color="accent"
                onClick={() => setEditing(true)}
              >
                <IconPencil size={16} aria-hidden />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      ) : null}

      <DateTimePicker
        className="rounded outline-none"
        label="Scheduled at"
        aria-label="Interview date and time"
        value={scheduledAt}
        onChange={(value) => setScheduledAt(value ? new Date(value) : null)}
        minDate={readOnly ? undefined : new Date()}
        disabled={readOnly}
      />
      <Select
        className="rounded outline-none"
        label="Timezone"
        aria-label="Interview timezone"
        data={tzOptions}
        value={timezone}
        onChange={(v) => setTimezone(v ?? defaultTz)}
        searchable
        disabled={readOnly}
      />
      <TextInput
        className="rounded outline-none"
        label="Duration (minutes)"
        aria-label="Interview duration in minutes"
        value={duration}
        onChange={(e) => setDuration(e.currentTarget.value)}
        disabled={readOnly}
      />
      <Group grow>
        <TextInput
          className="rounded outline-none"
          label="Interviewer name"
          aria-label="Interviewer name"
          value={interviewerName}
          onChange={(e) => setInterviewerName(e.currentTarget.value)}
          disabled={readOnly}
        />
        <TextInput
          className="rounded outline-none"
          label="Interviewer email"
          aria-label="Interviewer email"
          value={interviewerEmail}
          onChange={(e) => setInterviewerEmail(e.currentTarget.value)}
          disabled={readOnly}
        />
      </Group>
      <TextInput
        className="rounded outline-none"
        label="Meeting URL"
        aria-label="Meeting URL"
        value={meetingUrl}
        onChange={(e) => setMeetingUrl(e.currentTarget.value)}
        disabled={readOnly}
        description={
          readOnly && meetingUrl
            ? undefined
            : readOnly && !meetingUrl
              ? 'No meeting URL was saved'
              : undefined
        }
      />
      {readOnly && meetingUrl ? (
        <Text
          component="a"
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          c="accent"
          style={{ wordBreak: 'break-all' }}
          aria-label="Open meeting URL"
        >
          Open meeting link
        </Text>
      ) : null}

      {!readOnly ? (
        <Group gap="sm">
          <MotionButton
            className="cursor-pointer rounded-lg"
            aria-label={hasScheduled ? 'Update interview schedule' : 'Save interview schedule'}
            color="accent"
            loading={saving}
            onClick={() => void submit()}
          >
            {hasScheduled ? 'Update interview' : 'Schedule interview'}
          </MotionButton>
          {hasScheduled ? (
            <MotionButton
              className="cursor-pointer rounded-lg"
              aria-label="Cancel editing interview"
              variant="default"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                if (existing) {
                  setScheduledAt(new Date(existing.scheduled_at));
                  setTimezone(existing.timezone);
                  setDuration(String(existing.duration_minutes));
                  setInterviewerName(existing.interviewer_name ?? '');
                  setInterviewerEmail(existing.interviewer_email ?? '');
                  setMeetingUrl(existing.meeting_url ?? '');
                }
              }}
            >
              Cancel
            </MotionButton>
          ) : null}
        </Group>
      ) : null}
    </Stack>
  );
}
