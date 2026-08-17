import useSWR from 'swr';
import { api } from '@/lib/api';
import type { HrSettingsResult } from '@/types/api';

export function useHrSettings() {
  return useSWR<HrSettingsResult>('/api/hr/settings', (url: string) =>
    api<HrSettingsResult>(url),
  );
}
