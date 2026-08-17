'use client';

import useSWR from 'swr';
import type { HrErrorsListResult } from '@/types/api';

export function useHrErrors(resolved = false) {
  const params = new URLSearchParams({
    resolved: String(resolved),
    limit: '50',
  });
  return useSWR<HrErrorsListResult>(`/api/hr/errors?${params.toString()}`);
}
