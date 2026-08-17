'use client';

import useSWR from 'swr';
import type { PublicJobsGetResult } from '@/types/api';

export function usePublicJob(slug: string | undefined) {
  return useSWR<PublicJobsGetResult>(slug ? `/api/public/jobs/${slug}` : null);
}
