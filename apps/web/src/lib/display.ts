import { CANDIDATE_EMPLOYMENT_STATUS, labelOf } from '@/lib/labels';
import { date, money } from '@/lib/format';

export function formatAnswerValue(value: unknown, currency?: string | null): string {
  if (value == null || value === '') return 'Not answered';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  if (typeof value === 'number' && currency) return money(value, currency);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'true') return 'Yes';
    if (trimmed.toLowerCase() === 'false') return 'No';
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatAnswerValue(item, currency)).join(', ');
  }
  return String(value);
}

export function formatEmploymentStatus(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  return labelOf(CANDIDATE_EMPLOYMENT_STATUS, value, value);
}

export function formatAvailableFrom(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  return date(value);
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'label' in item) {
        return String((item as { label: unknown }).label).trim();
      }
      if (item == null) return '';
      const text = String(item).trim();
      return text.toLowerCase() === 'null' ? '' : text;
    })
    .filter(Boolean);
}
