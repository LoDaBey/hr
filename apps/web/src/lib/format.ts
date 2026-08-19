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

/** Format a CV work-history date as "Mar 2021". Returns empty for missing or invalid values. */
export function formatCvDate(value: unknown): string {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return '';
  if (raw.toLowerCase() === 'present') return 'Present';
  const parsed = dayjs(raw);
  if (parsed.isValid()) return parsed.format('MMM YYYY');
  if (/^\d{4}$/.test(raw)) return raw;
  return '';
}

/** Build a readable work-history range such as "Mar 2021 – Present". Omits empty parts. */
export function formatWorkDateRange(startRaw: unknown, endRaw: unknown): string {
  const start = formatCvDate(startRaw);
  const endIsPresent =
    endRaw == null ||
    endRaw === '' ||
    String(endRaw).trim().toLowerCase() === 'present' ||
    String(endRaw).trim().toLowerCase() === 'null';
  const end = endIsPresent ? (start ? 'Present' : '') : formatCvDate(endRaw);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end && end !== 'Present') return end;
  return '';
}

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
