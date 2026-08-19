'use client';

import { Stack, Text, Timeline } from '@mantine/core';
import dayjs from 'dayjs';
import { datetime } from '@/lib/format';
import { stageLabel, timelineEventTitle } from '@/lib/labels';
import type { RecruitmentEvent, Stage } from '@/types/domain';

type GroupedDay = {
  day: string;
  events: RecruitmentEvent[];
};

function groupTimelineByDay(events: RecruitmentEvent[]): GroupedDay[] {
  const groups = new Map<string, RecruitmentEvent[]>();
  for (const event of events) {
    const day = dayjs(event.created_at).isValid()
      ? dayjs(event.created_at).format('YYYY-MM-DD')
      : 'Unknown';
    const bucket = groups.get(day) ?? [];
    bucket.push(event);
    groups.set(day, bucket);
  }
  return [...groups.entries()].map(([day, dayEvents]) => ({ day, events: dayEvents }));
}

function formatDayHeading(day: string): string {
  if (day === 'Unknown') return 'Unknown date';
  const parsed = dayjs(day);
  return parsed.isValid() ? parsed.format('dddd, D MMMM YYYY') : day;
}

export function CandidateTimelineSection({ timeline }: { timeline: RecruitmentEvent[] }) {
  if (timeline.length === 0) {
    return <Text c="dimmed">No events yet.</Text>;
  }

  const grouped = groupTimelineByDay(timeline);

  return (
    <Stack gap="lg">
      {grouped.map((group) => (
        <Stack key={group.day} gap="sm">
          <Text size="sm" fw={700}>
            {formatDayHeading(group.day)}
          </Text>
          <Timeline active={timeline.length - 1} bulletSize={18} lineWidth={2} color="accent">
            {group.events.map((event) => (
                <Timeline.Item
                  key={event.id}
                  title={timelineEventTitle(event)}
                  bullet={<span aria-hidden />}
                >
                  <Text size="sm" c="dimmed">
                    {datetime(event.created_at)}
                    {event.actor_label ? ` · ${event.actor_label}` : ''}
                    {event.from_stage || event.to_stage
                      ? ` · ${event.from_stage ? stageLabel(event.from_stage as Stage) : '—'} → ${
                          event.to_stage ? stageLabel(event.to_stage as Stage) : '—'
                        }`
                      : ''}
                  </Text>
                </Timeline.Item>
              ))}
          </Timeline>
        </Stack>
      ))}
    </Stack>
  );
}
