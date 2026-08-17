import type { JobQuestionType } from '@/types/domain';
import type { QuestionDraft, SavedQuestionTemplate } from '@/types/job-editor';

const STORAGE_KEY = 'hr-question-library';
const MAX_SAVED = 40;

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadQuestionLibrary(): SavedQuestionTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedTemplate);
  } catch {
    return [];
  }
}

function isSavedTemplate(value: unknown): value is SavedQuestionTemplate {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.label === 'string' &&
    typeof row.type === 'string' &&
    typeof row.is_required === 'boolean' &&
    Array.isArray(row.options)
  );
}

function writeLibrary(rows: SavedQuestionTemplate[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_SAVED)));
}

/** Upsert labeled questions into the local library (by label + type). */
export function rememberQuestions(drafts: QuestionDraft[]): SavedQuestionTemplate[] {
  const labeled = drafts.filter((q) => q.label.trim().length > 0);
  if (labeled.length === 0) return loadQuestionLibrary();

  const existing = loadQuestionLibrary();
  const byKey = new Map(existing.map((row) => [`${row.label.trim().toLowerCase()}::${row.type}`, row]));

  for (const draft of labeled) {
    const key = `${draft.label.trim().toLowerCase()}::${draft.type}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      id: prev?.id ?? newId(),
      label: draft.label.trim(),
      type: draft.type,
      is_required: draft.is_required,
      options: [...draft.options],
      savedAt: new Date().toISOString(),
    });
  }

  const next = Array.from(byKey.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  writeLibrary(next);
  return next;
}

export function removeSavedQuestion(id: string): SavedQuestionTemplate[] {
  const next = loadQuestionLibrary().filter((row) => row.id !== id);
  writeLibrary(next);
  return next;
}

export function templateToDraft(template: SavedQuestionTemplate): QuestionDraft {
  return {
    draftId: newId(),
    key: '',
    label: template.label,
    type: template.type as JobQuestionType,
    is_required: template.is_required,
    options: [...template.options],
  };
}
