'use client';

import { Progress, Stack, Text } from '@mantine/core';
import { palette } from '@/theme';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(0)} MB`;
}

export function RecordingUploadProgress({
  loaded,
  total,
}: {
  loaded: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;

  return (
    <Stack gap="xs" w="100%" maw={420}>
      <Progress
        value={pct}
        color="accent"
        size="lg"
        radius="md"
        aria-label={`Upload progress ${pct} percent`}
        styles={{
          root: { backgroundColor: `${palette.ink}14` },
        }}
      />
      <Text size="sm" ta="center" style={{ color: palette.ink }}>
        {pct}% · {formatBytes(loaded)} of {formatBytes(total)}
      </Text>
    </Stack>
  );
}
