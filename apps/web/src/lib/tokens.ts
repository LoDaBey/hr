import 'server-only';
import { createHash } from 'crypto';

export function hashToken(raw: string): string {
  const pepper = process.env.TOKEN_PEPPER ?? '';
  if (!pepper) {
    console.error('Missing env var: TOKEN_PEPPER');
  }
  return createHash('sha256').update(raw + pepper).digest('hex');
}
