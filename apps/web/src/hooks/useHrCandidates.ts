'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useApi } from '@/hooks/useApi';
import type { HrCandidatesDeleteResult, HrCandidatesListResult } from '@/types/api';

export type HrCandidatesQuery = {
  job_id?: string | null;
  stage?: string | null;
  status?: string | null;
  q?: string | null;
  min_score?: string | null;
  min_experience?: string | null;
  page?: number;
  page_size?: number;
};

function buildKey(query: HrCandidatesQuery): string {
  const params = new URLSearchParams();
  if (query.job_id) params.set('job_id', query.job_id);
  if (query.stage) params.set('stage', query.stage);
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  if (query.min_score) params.set('min_score', query.min_score);
  if (query.min_experience) params.set('min_experience', query.min_experience);
  params.set('page', String(query.page ?? 1));
  params.set('page_size', String(query.page_size ?? 20));
  return `/api/hr/candidates?${params.toString()}`;
}

export function useHrCandidates(query: HrCandidatesQuery) {
  return useSWR<HrCandidatesListResult>(buildKey(query), {
    refreshInterval: (latest) =>
      latest?.rows.some((row) => row.screening_pending) ? 10_000 : 0,
  });
}

export function hrCandidatesKey(query: HrCandidatesQuery): string {
  return buildKey(query);
}

export function useDeleteHrCandidate() {
  const request = useApi();
  return useCallback(
    (applicationId: string) =>
      request<HrCandidatesDeleteResult>(`/api/hr/candidates/${applicationId}`, {
        method: 'DELETE',
      }),
    [request],
  );
}
