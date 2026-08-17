'use client';

import useSWR from 'swr';
import type { HrDashboardResult } from '@/types/api';

export function useHrDashboard() {
  return useSWR<HrDashboardResult>('/api/hr/dashboard');
}
