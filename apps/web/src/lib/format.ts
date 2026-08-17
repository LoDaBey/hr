import dayjs from 'dayjs';

export function date(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '—';
}

export function datetime(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '—';
}

export function money(
  amount: number | null | undefined,
  currency = 'USD',
): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
