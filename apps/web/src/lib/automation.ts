import 'server-only';
import type { AutomationResult, AutomationTask } from '@/types/api';

function isAutomationResult<T>(value: unknown): value is AutomationResult<T> {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false;
  const envelope = value as { ok: unknown; data?: unknown; error?: unknown };
  if (envelope.ok === true) return 'data' in envelope;
  if (envelope.ok === false && typeof envelope.error === 'object' && envelope.error !== null) {
    const error = envelope.error as { code?: unknown; message?: unknown };
    return typeof error.code === 'string' && typeof error.message === 'string';
  }
  return false;
}

export async function runAutomation<T>(
  task: AutomationTask,
  payload: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<AutomationResult<T>> {
  const url = process.env.N8N_AUTOMATION_URL;
  const secret = process.env.AUTOMATION_SECRET;
  if (!url) {
    console.error('Missing env var: N8N_AUTOMATION_URL');
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: `automation ${task} failed` } };
  }
  if (!secret) {
    console.error('Missing env var: AUTOMATION_SECRET');
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: `automation ${task} failed` } };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    console.error('[automation]', task, 'url=', url, 'secretLen=', secret.length,
                  'secretTail=', secret.slice(-4));
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-automation-secret': secret,
      },
      body: JSON.stringify({ task, payload, request_id: crypto.randomUUID() }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (isAutomationResult<T>(json)) return json;
    console.error('[automation]', task, 'status=', res.status,
                  'body=', text.slice(0, 300));
    const detail = text.trim().slice(0, 200) || `HTTP ${res.status}`;
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: `automation ${task} failed: ${detail}` },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: `automation ${task} failed: ${detail}` },
    };
  } finally {
    clearTimeout(timer);
  }
}
