'use client';

import useSWR from 'swr';
import type { HrCandidatesGetResult } from '@/types/api';

function shouldPollAssessmentGrading(data: HrCandidatesGetResult | undefined): boolean {
  const assessment = data?.assessment;
  if (!assessment || assessment.status !== 'SUBMITTED') return false;
  if (!assessment.review) return true;
  if (assessment.review.grading_error) return false;
  return !assessment.review.has_overall_evaluation;
}

export function useHrCandidate(applicationId: string | null) {
  return useSWR<HrCandidatesGetResult>(
    applicationId ? `/api/hr/candidates/${applicationId}` : null,
    {
      refreshInterval: (latest) => {
        if (latest?.screening_pending) return 10_000;
        if (shouldPollAssessmentGrading(latest)) return 10_000;
        return 0;
      },
    },
  );
}
