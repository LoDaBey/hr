'use client';

import useSWR from 'swr';
import type { HrJobsGetResult, HrJobsListResult } from '@/types/api';

export function useHrJobs(status?: string | null) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return useSWR<HrJobsListResult>(`/api/hr/jobs${params}`);
}

export function useHrJob(jobId: string | null) {
  return useSWR<HrJobsGetResult>(jobId ? `/api/hr/jobs/${jobId}` : null);
}
