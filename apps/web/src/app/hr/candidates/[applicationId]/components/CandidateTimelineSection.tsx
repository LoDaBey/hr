'use client';

import { Text } from '@mantine/core';
import { CandidateEventLog, type EventLogItem } from './CandidateEventLog';
import { datetime } from '@/lib/format';
import { stageLabel, timelineEventTitle } from '@/lib/labels';
import type { RecruitmentEvent, Stage } from '@/types/domain';

export function CandidateTimelineSection({ timeline }: { timeline: RecruitmentEvent[] }) {
  if (timeline.length === 0) {
    return <Text c="dimmed">No events yet.</Text>;
  }

  const sorted = [...timeline].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const items: EventLogItem[] = sorted.map((event) => {
    const stageChange =
      event.from_stage || event.to_stage
        ? `${event.from_stage ? stageLabel(event.from_stage as Stage) : '—'} → ${
            event.to_stage ? stageLabel(event.to_stage as Stage) : '—'
          }`
        : null;
    const parts = [
      event.actor_label ?? null,
      stageChange,
    ].filter(Boolean);

    return {
      id: String(event.id),
      title: timelineEventTitle(event),
      detail: parts.length > 0 ? parts.join(' · ') : datetime(event.created_at),
      timestamp: event.created_at,
    };
  });

  return <CandidateEventLog items={items} />;
}
