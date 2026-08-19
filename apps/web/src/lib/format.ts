import dayjs from 'dayjs';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTimePlugin);

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

export function time(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm') : '—';
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.fromNow() : '—';
}

export function formatDayHeading(day: string): string {
  if (day === 'Unknown') return 'Unknown date';
  const parsed = dayjs(day);
  return parsed.isValid() ? parsed.format('dddd, D MMMM YYYY') : day;
}

export function groupByDay<T extends { created_at: string }>(
  records: T[],
): Array<{ day: string; items: T[] }> {
  const sorted = [...records].sort(
    (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf(),
  );
  const groups = new Map<string, T[]>();
  for (const item of sorted) {
    const day = dayjs(item.created_at).isValid()
      ? dayjs(item.created_at).format('YYYY-MM-DD')
      : 'Unknown';
    const bucket = groups.get(day) ?? [];
    bucket.push(item);
    groups.set(day, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({ day, items }));
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
