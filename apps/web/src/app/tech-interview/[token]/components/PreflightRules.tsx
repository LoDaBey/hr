'use client';

import { List, Paper, Text } from '@mantine/core';
import { density, palette } from '@/theme';

export function PreflightRules({ rules }: { rules: string[] }) {
  if (rules.length === 0) return null;

  return (
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{
        borderColor: palette.border,
        background: palette.surface,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Text fw={600} mb="sm">
        Rules
      </Text>
      <List
        size="sm"
        spacing="xs"
        style={{ flex: 1, overflowY: 'auto', maxHeight: 'min(52vh, 420px)' }}
      >
        {rules.map((rule) => (
          <List.Item key={rule}>{rule}</List.Item>
        ))}
      </List>
    </Paper>
  );
}
