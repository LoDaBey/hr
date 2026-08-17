'use client';

import { Checkbox, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { density, palette } from '@/theme';

/** Checkbox card that keeps related fields visible, disabled until checked. */
export function CheckboxReveal({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <Paper
      withBorder
      p="md"
      radius={density.defaultRadius}
      style={{
        borderColor: checked ? `${palette.accent}55` : `${palette.ink}14`,
        background: checked ? `${palette.accent}0d` : palette.paper,
        transition: `border-color ${density.motion.durationFast}s ease, background ${density.motion.durationFast}s ease`,
      }}
    >
      <Stack gap="sm">
        <Checkbox
          size="md"
          label={
            <Stack gap={2}>
              <Text fw={600} size="sm" style={{ color: palette.ink }}>
                {label}
              </Text>
              {description ? (
                <Text size="xs" c="dimmed">
                  {description}
                </Text>
              ) : null}
            </Stack>
          }
          aria-label={label}
          checked={checked}
          onChange={(e) => onCheckedChange(e.currentTarget.checked)}
          styles={{
            body: { alignItems: 'flex-start' },
            label: { paddingInlineStart: 8 },
          }}
        />
        {children ? (
          <Stack
            gap="sm"
            pl={36}
            style={{
              opacity: checked ? 1 : 0.55,
              pointerEvents: checked ? 'auto' : 'none',
            }}
            aria-disabled={!checked}
          >
            {children}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
