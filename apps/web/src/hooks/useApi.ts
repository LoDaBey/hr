'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api';

export function useApi() {
  return useCallback(
    <T,>(path: string, init?: Parameters<typeof api>[1]) => api<T>(path, init),
    [],
  );
}
