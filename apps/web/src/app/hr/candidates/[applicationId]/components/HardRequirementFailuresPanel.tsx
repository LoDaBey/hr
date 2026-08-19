'use client';

import { Alert, Stack, Text } from '@mantine/core';
import {
  formatHardRequirementExpected,
  formatHardRequirementGot,
} from '@/lib/hard-requirements';
import { palette } from '@/theme';
import type { HardRequirementFailure } from '@/types/domain';

export function HardRequirementFailuresPanel({
  failures,
}: {
  failures: HardRequirementFailure[];
}) {
  const rejectable = failures.filter(
    (fail) => fail.on_fail === 'RECOMMEND_REJECT' && !fail.unevaluable,
  );
  if (rejectable.length === 0) return null;

  return (
    <Alert color="warning" variant="light" title="Hard requirement failures">
      <Stack gap="xs">
        {rejectable.map((fail) => (
          <Text key={fail.key} size="sm" style={{ color: palette.ink }}>
            <Text component="span" fw={600}>
              {fail.label}
            </Text>
            {' — expected '}
            {formatHardRequirementExpected(fail.required)}
            {', got '}
            {formatHardRequirementGot(fail.got)}
          </Text>
        ))}
      </Stack>
    </Alert>
  );
}
