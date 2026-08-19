'use client';

import { Group, Stack, Text, Timeline } from '@mantine/core';
import { datetime, formatDayHeading, groupByDay, relativeTime } from '@/lib/format';
import { palette } from '@/theme';

export type EventLogItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  actions?: React.ReactNode;
};

export function CandidateEventLog({ items }: { items: EventLogItem[] }) {
  if (items.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Nothing to show yet.
      </Text>
    );
  }

  const grouped = groupByDay(items.map((item) => ({ ...item, created_at: item.timestamp })));

  return (
    <Stack gap="lg">
      {grouped.map((group) => (
        <Stack key={group.day} gap="sm">
          <Text size="sm" fw={700} style={{ color: palette.ink }}>
            {formatDayHeading(group.day)}
          </Text>
          <Timeline bulletSize={14} lineWidth={2} color="accent">
            {group.items.map((item) => (
              <Timeline.Item key={item.id} title={item.title} bullet={<span aria-hidden />}>
                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    {item.detail}
                  </Text>
                  <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                    <Text
                      size="xs"
                      c="dimmed"
                      title={datetime(item.timestamp)}
                      style={{ cursor: 'default' }}
                    >
                      {relativeTime(item.timestamp)}
                    </Text>
                    {item.actions}
                  </Group>
                </Stack>
              </Timeline.Item>
            ))}
          </Timeline>
        </Stack>
      ))}
    </Stack>
  );
}
