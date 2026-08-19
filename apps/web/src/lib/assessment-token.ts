import 'server-only';
import { one } from '@/lib/db';
import { hashToken } from '@/lib/tokens';
import type { ErrorCode } from '@/types/api';
import type { SittingStatus, Stage, TokenPurpose } from '@/types/domain';

export type ResolvedAssessmentToken = {
  token_id: string;
  expires_at: string;
  used_at: string | null;
  sitting_id: string;
  application_id: string;
  assessment_id: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  status: SittingStatus;
  invite_deadline: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at_sitting: string | null;
  submitted_at: string | null;
  late: boolean;
  recording_status: string | null;
  stage: Stage;
  candidate_name: string;
  email: string;
  job_title: string;
  title: string;
  instructions: string | null;
  assessment_duration_minutes: number;
  require_camera: boolean;
  require_mic: boolean;
  require_fullscreen: boolean;
  require_screen_share: boolean;
  rules: string | null;
};

export type TokenResolveFailure = {
  code: Extract<
    ErrorCode,
    'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'ALREADY_SUBMITTED'
  >;
  message: string;
};

type TokenRow = {
  token_id: string;
  expires_at: string;
  used_at: string | null;
  sitting_id: string;
  application_id: string;
  assessment_id: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  status: SittingStatus;
  invite_deadline: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at_sitting: string | null;
  submitted_at: string | null;
  late: boolean;
  recording_status: string | null;
  stage: Stage;
  candidate_name: string;
  email: string;
  job_title: string;
  title: string;
  instructions: string | null;
  assessment_duration_minutes: number;
  require_camera: boolean;
  require_mic: boolean;
  require_fullscreen: boolean;
  require_screen_share: boolean;
  rules: string | null;
};

export async function resolveToken(
  raw: string,
  purpose: TokenPurpose,
): Promise<{ ok: true; data: ResolvedAssessmentToken } | { ok: false; error: TokenResolveFailure }> {
  const row = await one<TokenRow>(
    `SELECT t.id AS token_id, t.expires_at, t.used_at,
            ca.id AS sitting_id, ca.application_id, ca.assessment_id, ca.kind,
            ca.status, ca.invite_deadline, ca.duration_minutes,
            ca.started_at, ca.expires_at AS expires_at_sitting,
            ca.submitted_at, ca.late, ca.recording_status,
            a.stage,
            c.full_name AS candidate_name, c.email,
            j.title AS job_title,
            s.title, s.instructions, s.duration_minutes AS assessment_duration_minutes,
            s.require_camera, s.require_mic, s.require_fullscreen, s.require_screen_share, s.rules
     FROM HRSYSTEM_access_tokens t
     JOIN HRSYSTEM_candidate_assessments ca ON ca.id = t.candidate_assessment_id
     JOIN HRSYSTEM_assessments s ON s.id = ca.assessment_id
     JOIN HRSYSTEM_applications a ON a.id = ca.application_id
     JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
     JOIN HRSYSTEM_jobs j ON j.id = a.job_id
     WHERE t.token_hash = $1 AND t.purpose = $2`,
    [hashToken(raw), purpose],
  );

  if (!row) {
    return {
      ok: false,
      error: { code: 'TOKEN_INVALID', message: 'This link is not valid.' },
    };
  }

  if (row.status === 'CANCELLED') {
    return {
      ok: false,
      error: { code: 'TOKEN_INVALID', message: 'This link is no longer valid.' },
    };
  }

  if (row.status === 'SUBMITTED') {
    return {
      ok: false,
      error: {
        code: 'ALREADY_SUBMITTED',
        message: 'You have already submitted this session. Thank you.',
      },
    };
  }

  if (
    row.status === 'INVITED' &&
    row.invite_deadline &&
    new Date(row.invite_deadline).getTime() < Date.now()
  ) {
    return {
      ok: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'The window to start this session has closed. Contact us if you had a problem.',
      },
    };
  }

  return {
    ok: true,
    data: {
      token_id: row.token_id,
      expires_at: row.expires_at,
      used_at: row.used_at,
      sitting_id: row.sitting_id,
      application_id: row.application_id,
      assessment_id: row.assessment_id,
      kind: row.kind,
      status: row.status,
      invite_deadline: row.invite_deadline,
      duration_minutes: row.duration_minutes,
      started_at: row.started_at,
      expires_at_sitting: row.expires_at_sitting,
      submitted_at: row.submitted_at,
      late: row.late,
      recording_status: row.recording_status,
      stage: row.stage,
      candidate_name: row.candidate_name,
      email: row.email,
      job_title: row.job_title,
      title: row.title,
      instructions: row.instructions,
      assessment_duration_minutes: row.assessment_duration_minutes,
      require_camera: row.require_camera,
      require_mic: row.require_mic,
      require_fullscreen: row.require_fullscreen,
      require_screen_share: row.require_screen_share,
      rules: row.rules,
    },
  };
}

export function rulesToList(rules: string | null | undefined): string[] {
  if (!rules?.trim()) return [];
  return rules
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
