'use client';

import useSWR from 'swr';
import type { HrCandidatesGetResult } from '@/types/api';

export function useHrCandidate(applicationId: string | null) {
  return useSWR<HrCandidatesGetResult>(
    applicationId ? `/api/hr/candidates/${applicationId}` : null,
  );
}
