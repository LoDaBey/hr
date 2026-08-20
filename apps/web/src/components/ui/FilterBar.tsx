'use client';

import { Badge, CloseButton, Group, Stack } from '@mantine/core';
import { MotionButton } from '@/components/MotionButton';
import type { FilterBarProps } from '@/types/ui';
import { palette } from '@/theme';

export function FilterBar({ children, chips = [], onClearAll }: FilterBarProps) {
  const hasChips = chips.length > 0;

  return (
    <Stack gap="sm" mb="md">
      <Group gap="sm" wrap="wrap" align="flex-end">
        {children}
      </Group>
      {hasChips ? (
        <Group gap={6} wrap="wrap">
          {chips.map((chip) => (
            <Badge
              key={chip.key}
              variant="outline"
              color="ink"
              rightSection={
                <CloseButton
                  size="xs"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={chip.onRemove}
                  iconSize={10}
                />
              }
              styles={{
                root: {
                  textTransform: 'none',
                  fontWeight: 500,
                  borderColor: palette.borderStrong,
                  paddingRight: 4,
                },
              }}
            >
              {chip.label}
            </Badge>
          ))}
          {onClearAll ? (
            <MotionButton
              variant="subtle"
              size="compact-xs"
              color="ink"
              aria-label="Clear all filters"
              onClick={onClearAll}
            >
              Clear all
            </MotionButton>
          ) : null}
        </Group>
      ) : null}
    </Stack>
  );
}
