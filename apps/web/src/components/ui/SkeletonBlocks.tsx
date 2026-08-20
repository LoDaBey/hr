'use client';

import { Stack, Skeleton } from '@mantine/core';
import { SimpleGrid } from '@mantine/core';

export function MetricCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={88} radius="md" />
      ))}
    </SimpleGrid>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Stack gap="xs">
      <Skeleton height={36} radius="sm" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={48} radius="sm" />
      ))}
    </Stack>
  );
}

export function PageSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton height={32} width={200} radius="sm" />
      <Skeleton height={16} width={320} radius="sm" />
      <Skeleton height={200} radius="md" mt="sm" />
    </Stack>
  );
}
