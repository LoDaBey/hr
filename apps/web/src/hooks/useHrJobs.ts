'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useApi } from '@/hooks/useApi';
import type { HrJobsDeleteResult, HrJobsGetResult, HrJobsListResult } from '@/types/api';

export function useHrJobs(status?: string | null) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return useSWR<HrJobsListResult>(`/api/hr/jobs${params}`);
}

export function useHrJob(jobId: string | null) {
  return useSWR<HrJobsGetResult>(jobId ? `/api/hr/jobs/${jobId}` : null);
}

export function useDeleteHrJob() {
  const request = useApi();
  return useCallback(
    (jobId: string) => request<HrJobsDeleteResult>(`/api/hr/jobs/${jobId}`, { method: 'DELETE' }),
    [request],
  );
}
