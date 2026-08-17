/** Escape text before interpolating into HTML email templates. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function variablesRecord(variables: unknown): Record<string, unknown> {
  if (typeof variables === 'object' && variables !== null && !Array.isArray(variables)) {
    return variables as Record<string, unknown>;
  }
  return {};
}

/**
 * Replace `{{var}}` placeholders. Missing keys render empty.
 * Any leftover `{{…}}` is logged and stripped so the inbox never shows raw tokens.
 */
export function renderTemplate(template: string, variables: unknown): string {
  const vars = variablesRecord(variables);
  const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const raw = vars[key];
    if (raw == null) return '';
    return escapeHtml(String(raw));
  });

  const unresolved = rendered.match(/\{\{[^}]*\}\}/g);
  if (unresolved?.length) {
    console.error('Unresolved email template placeholders', unresolved);
    return rendered.replace(/\{\{[^}]*\}\}/g, '');
  }
  return rendered;
}
