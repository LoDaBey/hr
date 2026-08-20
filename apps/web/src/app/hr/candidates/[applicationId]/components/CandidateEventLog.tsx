'use client';

import { Box, Group, Stack, Text, Timeline } from '@mantine/core';
import { datetime, formatDayHeading, groupByDay, relativeTime } from '@/lib/format';
import { palette, shadows } from '@/theme';

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
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            style={{ color: palette.muted, letterSpacing: '0.05em' }}
          >
            {formatDayHeading(group.day)}
          </Text>
          <Timeline active={group.items.length} bulletSize={18} lineWidth={2} color="accent">
            {group.items.map((item) => (
              <Timeline.Item
                key={item.id}
                title={
                  <Text fw={600} size="sm" style={{ color: palette.ink }}>
                    {item.title}
                  </Text>
                }
                bullet={
                  <Box
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: palette.accent,
                      boxShadow: `0 0 0 3px ${palette.accent}22`,
                    }}
                  />
                }
              >
                <Box
                  p="sm"
                  mt={4}
                  style={{
                    background: palette.paper,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 8,
                    boxShadow: shadows.sm,
                  }}
                >
                  <Stack gap={6}>
                    {item.detail ? (
                      <Text size="sm" style={{ color: palette.muted, lineHeight: 1.45 }}>
                        {item.detail}
                      </Text>
                    ) : null}
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
                </Box>
              </Timeline.Item>
            ))}
          </Timeline>
        </Stack>
      ))}
    </Stack>
  );
}
