import 'server-only';
import type { AutomationResult, AutomationTask } from '@/types/api';

/**
 * ROUTE_BUDGET_SECONDS mirrors the `export const maxDuration` literal on every route that
 * calls runAutomation(). Next.js requires maxDuration to be a static literal, so it cannot
 * import this constant — the routes carry `= 60` with a comment pointing here.
 *
 * INVARIANT: every value in TASK_TIMEOUT_MS must be strictly less than
 * ROUTE_BUDGET_SECONDS * 1000, with headroom for the surrounding SQL. A route that dies
 * while awaiting an automation throws away a result that has already been paid for.
 *
 * The pipeline sweep composes some of these: a screening claim that still needs its CV
 * parsed costs cv.parse + screening.run. Every value here, and every combination the sweep
 * can compose, must stay below SWEEP_BUDGET_MS in src/lib/pipeline/sweep.ts.
 *
 * If the deployment ever allows longer functions, raise ROUTE_BUDGET_SECONDS, raise the
 * maxDuration literal in each route listed below, and these timeouts can grow with it.
 * Routes: cron/pipeline-sweep, hr/candidates/[applicationId]/{assessment,techtest}/grade-now,
 *         hr/candidates/[applicationId]/{assessment,techtest}/invite/send-now,
 *         hr/emails/[communicationId]/send-now, public/applications,
 *         {assessment,techtest}/[token]/submit
 */
export const ROUTE_BUDGET_SECONDS = 60;

export const TASK_TIMEOUT_MS: Record<AutomationTask, number> = {
  'cv.parse': 25_000,
  'screening.run': 20_000,
  'assessment.grade': 25_000,
  'email.send': 15_000,
  'recording.grade': 45_000,
};

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

  const timeoutMs = opts.timeoutMs ?? TASK_TIMEOUT_MS[task];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
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
    console.error('[automation] unexpected response', task, 'status=', res.status,
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
