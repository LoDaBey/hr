import 'server-only';
import { randomBytes } from 'crypto';
import type { PoolClient, QueryResultRow } from 'pg';
import { tx } from '@/lib/db';
import { datetime } from '@/lib/format';
import { hashToken } from '@/lib/tokens';
import type { HrInviteResult } from '@/types/api';
import type { ActorType, Stage } from '@/types/domain';

export type InviteKind = 'ASSESSMENT' | 'TECH_TEST';

export type InviteActor = {
  type: ActorType;
  id?: string | null;
  label?: string | null;
};

export type IssueInviteOptions = {
  kind: InviteKind;
  sendAt: Date;
  actor: InviteActor;
  client?: PoolClient;
  /** Also write ASSESSMENT_AUTO_SCHEDULED / TECHTEST_AUTO_SCHEDULED. */
  autoScheduled?: boolean;
};

export type IssueInviteResult =
  | { ok: true; data: HrInviteResult; sendAt: string }
  | { ok: false; reason: 'not_found' | 'wrong_stage' | 'no_assessment' };

type KindConfig = {
  inviteStages: Stage[];
  assessmentKind: InviteKind;
  targetStage: Stage;
  revertStage: Stage;
  eventInvited: string;
  eventAuto: string;
  eventCancelled: string;
  templateKey: string;
  purpose: InviteKind;
  linkPath: string;
  inviteHoursColumn: 'assessment_invite_hours' | 'techtest_invite_hours';
  withRecordingStatus: boolean;
  linkVar: 'assessment_link' | 'interview_link';
};

const KIND_CONFIG: Record<InviteKind, KindConfig> = {
  ASSESSMENT: {
    inviteStages: ['INITIAL_SHORTLISTED', 'TECH_ASSESSMENT_SENT', 'TECH_ASSESSMENT_STARTED'],
    assessmentKind: 'ASSESSMENT',
    targetStage: 'TECH_ASSESSMENT_SENT',
    revertStage: 'INITIAL_SHORTLISTED',
    eventInvited: 'ASSESSMENT_INVITED',
    eventAuto: 'ASSESSMENT_AUTO_SCHEDULED',
    eventCancelled: 'ASSESSMENT_INVITE_CANCELLED',
    templateKey: 'ASSESSMENT_INVITE',
    purpose: 'ASSESSMENT',
    linkPath: '/assessment/',
    inviteHoursColumn: 'assessment_invite_hours',
    withRecordingStatus: false,
    linkVar: 'assessment_link',
  },
  TECH_TEST: {
    inviteStages: ['TECH_SHORTLISTED', 'RECORDED_TECH_INVITED', 'RECORDED_TECH_STARTED'],
    assessmentKind: 'TECH_TEST',
    targetStage: 'RECORDED_TECH_INVITED',
    revertStage: 'TECH_SHORTLISTED',
    eventInvited: 'TECHTEST_INVITED',
    eventAuto: 'TECHTEST_AUTO_SCHEDULED',
    eventCancelled: 'TECHTEST_INVITE_CANCELLED',
    templateKey: 'TECHTEST_INVITE',
    purpose: 'TECH_TEST',
    linkPath: '/tech-interview/',
    inviteHoursColumn: 'techtest_invite_hours',
    withRecordingStatus: true,
    linkVar: 'interview_link',
  },
};

async function oneTx<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await client.query<T>(sql, params);
  return res.rows[0] ?? null;
}

async function withClient<T>(
  client: PoolClient | undefined,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  if (client) return fn(client);
  return tx(fn);
}

/**
 * Cancel any open sitting, create a new one, hash a token, move the stage,
 * audit, and queue the invite email with `scheduled_for = sendAt`.
 * `invite_deadline` starts from sendAt (when the email lands), not from now.
 */
export async function issueInvite(
  applicationId: string,
  options: IssueInviteOptions,
): Promise<IssueInviteResult> {
  const config = KIND_CONFIG[options.kind];
  const sendAtIso = options.sendAt.toISOString();

  return withClient(options.client, async (client) => {
    const application = await oneTx<{
      id: string;
      stage: Stage;
      candidate_id: string;
      job_id: string;
      email: string;
      full_name: string;
      title: string;
      invite_hours: number;
    }>(
      client,
      `SELECT a.id, a.stage, a.candidate_id, a.job_id,
              c.email, c.full_name, j.title,
              j.${config.inviteHoursColumn} AS invite_hours
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [applicationId],
    );

    if (!application) {
      return { ok: false, reason: 'not_found' };
    }

    if (!config.inviteStages.includes(application.stage)) {
      return { ok: false, reason: 'wrong_stage' };
    }

    const assessment = await oneTx<{ id: string; duration_minutes: number }>(
      client,
      `SELECT id, duration_minutes
       FROM assessments
       WHERE job_id = $1 AND kind = $2 AND is_active = true
       LIMIT 1`,
      [application.job_id, config.assessmentKind],
    );

    if (!assessment) {
      return { ok: false, reason: 'no_assessment' };
    }

    await client.query(
      `UPDATE candidate_assessments
       SET status = 'CANCELLED', updated_at = now()
       WHERE application_id = $1
         AND kind = $2
         AND status IN ('INVITED', 'STARTED')`,
      [applicationId, config.assessmentKind],
    );

    const sitting = config.withRecordingStatus
      ? await oneTx<{ id: string; invite_deadline: string; duration_minutes: number }>(
          client,
          `INSERT INTO candidate_assessments (
             application_id, assessment_id, kind, status,
             invite_deadline, duration_minutes, recording_status
           )
           VALUES (
             $1, $2, $3, 'INVITED',
             $4::timestamptz + make_interval(hours => $5::int),
             $6, 'UPLOAD_PENDING'
           )
           RETURNING id, invite_deadline, duration_minutes`,
          [
            applicationId,
            assessment.id,
            config.assessmentKind,
            sendAtIso,
            application.invite_hours,
            assessment.duration_minutes,
          ],
        )
      : await oneTx<{ id: string; invite_deadline: string; duration_minutes: number }>(
          client,
          `INSERT INTO candidate_assessments (
             application_id, assessment_id, kind, status,
             invite_deadline, duration_minutes
           )
           VALUES (
             $1, $2, $3, 'INVITED',
             $4::timestamptz + make_interval(hours => $5::int),
             $6
           )
           RETURNING id, invite_deadline, duration_minutes`,
          [
            applicationId,
            assessment.id,
            config.assessmentKind,
            sendAtIso,
            application.invite_hours,
            assessment.duration_minutes,
          ],
        );

    if (!sitting) {
      throw new Error(`Failed to create ${config.assessmentKind} sitting`);
    }

    const raw = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(raw);

    await client.query(
      `INSERT INTO access_tokens (
         token_hash, purpose, application_id, candidate_assessment_id, expires_at
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenHash, config.purpose, applicationId, sitting.id, sitting.invite_deadline],
    );

    const fromStage = application.stage;
    await client.query(
      `UPDATE applications
       SET stage = $2::app_stage, updated_at = now()
       WHERE id = $1`,
      [applicationId, config.targetStage],
    );

    await client.query(
      `INSERT INTO recruitment_events (
         application_id, candidate_id, job_id, event_type,
         from_stage, to_stage, actor_type, actor_id, actor_label, payload
       ) VALUES (
         $1, $2, $3, $4,
         $5::app_stage, $6::app_stage,
         $7, $8, $9, $10::jsonb
       )`,
      [
        applicationId,
        application.candidate_id,
        application.job_id,
        config.eventInvited,
        fromStage,
        config.targetStage,
        options.actor.type,
        options.actor.id ?? null,
        options.actor.label ?? null,
        JSON.stringify({
          candidate_assessment_id: sitting.id,
          invite_deadline: sitting.invite_deadline,
          duration_minutes: sitting.duration_minutes,
          scheduled_for: sendAtIso,
        }),
      ],
    );

    if (options.autoScheduled) {
      await client.query(
        `INSERT INTO recruitment_events (
           application_id, candidate_id, job_id, event_type,
           from_stage, to_stage, actor_type, actor_id, actor_label, payload
         ) VALUES (
           $1, $2, $3, $4,
           $5::app_stage, $6::app_stage,
           $7, $8, $9, $10::jsonb
         )`,
        [
          applicationId,
          application.candidate_id,
          application.job_id,
          config.eventAuto,
          fromStage,
          config.targetStage,
          options.actor.type,
          options.actor.id ?? null,
          options.actor.label ?? null,
          JSON.stringify({
            candidate_assessment_id: sitting.id,
            scheduled_for: sendAtIso,
            kind: options.kind,
          }),
        ],
      );
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
    const link = `${base}${config.linkPath}${raw}`;

    const variables: Record<string, string> = {
      candidate_name: application.full_name,
      job_title: application.title,
      hr_name: options.actor.label ?? 'HR',
      assessment_deadline: datetime(sitting.invite_deadline),
      duration_minutes: String(sitting.duration_minutes),
      [config.linkVar]: link,
    };

    await client.query(
      `INSERT INTO communications (
         candidate_id, application_id, template_key, to_email,
         variables, dedupe_key, scheduled_for
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::timestamptz)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        application.candidate_id,
        applicationId,
        config.templateKey,
        application.email,
        JSON.stringify(variables),
        `${applicationId}:${config.templateKey}:${sitting.id}`,
        sendAtIso,
      ],
    );

    return {
      ok: true,
      data: {
        candidate_assessment_id: sitting.id,
        invite_deadline: sitting.invite_deadline,
        link,
      },
      sendAt: sendAtIso,
    };
  });
}

export type InviteControlResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'nothing_pending' | 'wrong_stage' };

/** Bump a still-PENDING invite email to send immediately. */
export async function sendInviteNow(
  applicationId: string,
  kind: InviteKind,
  actor: InviteActor,
): Promise<InviteControlResult> {
  const config = KIND_CONFIG[kind];

  return tx(async (client) => {
    const application = await oneTx<{ id: string; stage: Stage; candidate_id: string; job_id: string }>(
      client,
      `SELECT id, stage, candidate_id, job_id FROM applications WHERE id = $1 FOR UPDATE`,
      [applicationId],
    );
    if (!application) return { ok: false, reason: 'not_found' };

    const sitting = await oneTx<{ id: string }>(
      client,
      `SELECT id FROM candidate_assessments
       WHERE application_id = $1 AND kind = $2 AND status IN ('INVITED', 'STARTED')
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId, kind],
    );
    if (!sitting) return { ok: false, reason: 'nothing_pending' };

    const updated = await oneTx<{ id: string }>(
      client,
      `UPDATE communications
       SET scheduled_for = now()
       WHERE application_id = $1
         AND template_key = $2
         AND dedupe_key = $3
         AND status = 'PENDING'
       RETURNING id`,
      [applicationId, config.templateKey, `${applicationId}:${config.templateKey}:${sitting.id}`],
    );
    if (!updated) return { ok: false, reason: 'nothing_pending' };

    await client.query(
      `INSERT INTO recruitment_events (
         application_id, candidate_id, job_id, event_type,
         from_stage, to_stage, actor_type, actor_id, actor_label, payload
       ) VALUES (
         $1, $2, $3, $4,
         $5::app_stage, $5::app_stage,
         $6, $7, $8, $9::jsonb
       )`,
      [
        applicationId,
        application.candidate_id,
        application.job_id,
        `${kind === 'ASSESSMENT' ? 'ASSESSMENT' : 'TECHTEST'}_INVITE_SEND_NOW`,
        application.stage,
        actor.type,
        actor.id ?? null,
        actor.label ?? null,
        JSON.stringify({ candidate_assessment_id: sitting.id, communication_id: updated.id }),
      ],
    );

    return { ok: true };
  });
}

/**
 * Cancel a scheduled invite: sitting + token + queued email, revert stage.
 * Only while the invite email is still PENDING.
 */
export async function cancelScheduledInvite(
  applicationId: string,
  kind: InviteKind,
  actor: InviteActor,
): Promise<InviteControlResult> {
  const config = KIND_CONFIG[kind];

  return tx(async (client) => {
    const application = await oneTx<{
      id: string;
      stage: Stage;
      candidate_id: string;
      job_id: string;
    }>(
      client,
      `SELECT id, stage, candidate_id, job_id FROM applications WHERE id = $1 FOR UPDATE`,
      [applicationId],
    );
    if (!application) return { ok: false, reason: 'not_found' };

    if (application.stage !== config.targetStage) {
      return { ok: false, reason: 'wrong_stage' };
    }

    const sitting = await oneTx<{ id: string }>(
      client,
      `SELECT id FROM candidate_assessments
       WHERE application_id = $1 AND kind = $2 AND status = 'INVITED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId, kind],
    );
    if (!sitting) return { ok: false, reason: 'nothing_pending' };

    const cancelled = await oneTx<{ id: string }>(
      client,
      `UPDATE communications
       SET status = 'CANCELLED'
       WHERE application_id = $1
         AND template_key = $2
         AND dedupe_key = $3
         AND status = 'PENDING'
       RETURNING id`,
      [applicationId, config.templateKey, `${applicationId}:${config.templateKey}:${sitting.id}`],
    );
    if (!cancelled) return { ok: false, reason: 'nothing_pending' };

    await client.query(
      `UPDATE candidate_assessments
       SET status = 'CANCELLED', updated_at = now()
       WHERE id = $1`,
      [sitting.id],
    );

    await client.query(
      `UPDATE access_tokens
       SET expires_at = now()
       WHERE candidate_assessment_id = $1 AND used_at IS NULL`,
      [sitting.id],
    );

    await client.query(
      `UPDATE applications
       SET stage = $2::app_stage, updated_at = now()
       WHERE id = $1`,
      [applicationId, config.revertStage],
    );

    await client.query(
      `INSERT INTO recruitment_events (
         application_id, candidate_id, job_id, event_type,
         from_stage, to_stage, actor_type, actor_id, actor_label, payload
       ) VALUES (
         $1, $2, $3, $4,
         $5::app_stage, $6::app_stage,
         $7, $8, $9, $10::jsonb
       )`,
      [
        applicationId,
        application.candidate_id,
        application.job_id,
        config.eventCancelled,
        config.targetStage,
        config.revertStage,
        actor.type,
        actor.id ?? null,
        actor.label ?? null,
        JSON.stringify({
          candidate_assessment_id: sitting.id,
          communication_id: cancelled.id,
        }),
      ],
    );

    return { ok: true };
  });
}

export async function auditAutoInviteSkipped(
  client: PoolClient,
  input: {
    applicationId: string;
    candidateId: string;
    jobId: string;
    stage: Stage;
    kind: InviteKind;
    reason: string;
    actor: InviteActor;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO recruitment_events (
       application_id, candidate_id, job_id, event_type,
       from_stage, to_stage, actor_type, actor_id, actor_label, payload
     ) VALUES (
       $1, $2, $3, 'AUTO_INVITE_SKIPPED',
       $4::app_stage, $4::app_stage,
       $5, $6, $7, $8::jsonb
     )`,
    [
      input.applicationId,
      input.candidateId,
      input.jobId,
      input.stage,
      input.actor.type,
      input.actor.id ?? null,
      input.actor.label ?? null,
      JSON.stringify({ kind: input.kind, reason: input.reason }),
    ],
  );
}
