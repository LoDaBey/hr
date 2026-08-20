import type { AssessmentDraft } from '@/types/job-editor';

const ALWAYS_RULES = [
  'This session is recorded',
  'Do not switch tabs or use another application',
  'Do not leave the session',
  'Do not share your screen with anyone else',
  'Do not use any other devices',
  'Do not use any other browsers',
] as const;

/** Build candidate-facing rules from Require toggles (TECH_TEST). */
export function buildTechTestRules(opts: {
  require_camera: boolean;
  require_mic: boolean;
  require_fullscreen: boolean;
  require_screen_share: boolean;
}): string {
  const lines: string[] = [...ALWAYS_RULES];
  if (opts.require_camera) {
    lines.push('Your camera must stay on for the whole session');
  }
  if (opts.require_mic) {
    lines.push('Your microphone must stay on for the whole session');
  }
  if (opts.require_fullscreen) {
    lines.push('Stay in fullscreen — leaving it is recorded');
  }
  if (opts.require_screen_share) {
    lines.push('Share your entire screen, not a single tab or window');
  }
  return lines.join('\n');
}

export function techTestRulesFromDraft(draft: Pick<
  AssessmentDraft,
  'require_camera' | 'require_mic' | 'require_fullscreen' | 'require_screen_share'
>): string {
  return buildTechTestRules(draft);
}

export function techTestRulesList(opts: {
  require_camera: boolean;
  require_mic: boolean;
  require_fullscreen: boolean;
  require_screen_share: boolean;
}): string[] {
  return buildTechTestRules(opts)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
