/** Derive a stable question key from its label. Used on save, not on every keystroke. */
export function deriveQuestionKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return base || 'question';
}

/**
 * Assign keys for a question list. Existing keys are kept; new rows (empty key)
 * get a label-derived key with `_2`, `_3`, … on collision.
 */
export function assignQuestionKeys(questions: Array<{ key: string; label: string }>): string[] {
  const used = new Set<string>();
  for (const q of questions) {
    if (q.key) used.add(q.key);
  }

  return questions.map((q) => {
    if (q.key) return q.key;

    const base = deriveQuestionKey(q.label);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      const suffix = `_${n}`;
      candidate = `${base.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
      n += 1;
    }
    used.add(candidate);
    return candidate;
  });
}
