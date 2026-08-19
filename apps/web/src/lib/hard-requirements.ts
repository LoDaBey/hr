export function formatHardRequirementExpected(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (value == null) return '—';
  return String(value);
}

export function formatHardRequirementGot(value: unknown): string {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return 'Not provided';
  return String(value);
}
