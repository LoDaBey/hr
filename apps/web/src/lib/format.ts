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

const CURRENCY_ISO: Record<string, string> = {
  EGP: 'EGP',
  USD: 'USD',
  AED: 'AED',
  Dirham: 'AED',
};

export function money(
  amount: number | null | undefined,
  currency = 'USD',
): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const iso = CURRENCY_ISO[currency] ?? currency;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: iso,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
