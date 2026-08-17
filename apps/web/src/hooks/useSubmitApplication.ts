'use client';

import { useApi } from '@/hooks/useApi';
import type { ApplicationSubmitPayload, ApplicationSubmitResult } from '@/types/api';

export function useSubmitApplication() {
  const request = useApi();
  return (body: ApplicationSubmitPayload) =>
    request<ApplicationSubmitResult>('/api/public/applications', { method: 'POST', body });
}
