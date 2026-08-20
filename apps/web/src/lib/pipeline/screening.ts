import 'server-only';
import { signedDeliveryUrl } from '@/lib/cloudinary';
import { runAutomation } from '@/lib/automation';
import { one, query, tx } from '@/lib/db';
import {
  auditAutoInviteSkipped,
  issueInvite,
} from '@/lib/pipeline/invites';
import { appendEvent } from '@/lib/repos/events';
import { getAppSettings } from '@/lib/repos/app-settings';
import { enqueueCommunication } from '@/lib/repos/communications';
import { insertWorkflowError } from '@/lib/repos/workflow-errors';
import type { CvParseData, ScreeningRunData } from '@/types/api';
import type {
  Application,
  Document,
  HardRequirement,
  HardRequirementFailure,
  Job,
  Recommendation,
  Stage,
} from '@/types/domain';
import {
  formatHardRequirementExpected,
  formatHardRequirementGot,
} from '@/lib/hard-requirements';

const RECOMMENDATIONS: Recommendation[] = [
  'STRONG_SHORTLIST',
  'SHORTLIST',
  'MANUAL_REVIEW',
  'RECOMMEND_REJECT',
];

function asRecommendation(value: unknown): Recommendation {
  if (typeof value !== 'string') return 'MANUAL_REVIEW';
  const upper = value.toUpperCase() as Recommendation;
  return RECOMMENDATIONS.includes(upper) ? upper : 'MANUAL_REVIEW';
}

/** Job threshold wins when set; otherwise company default from Settings. */
function resolveShortlistCutOff(
  jobThreshold: number | null | undefined,
  defaultThreshold: number,
): { cutOff: number; usedJobThreshold: boolean } {
  if (jobThreshold != null && Number.isFinite(Number(jobThreshold))) {
    return { cutOff: Number(jobThreshold), usedJobThreshold: true };
  }
  return { cutOff: defaultThreshold, usedJobThreshold: false };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'label' in item) {
        return String((item as { label: unknown }).label);
      }
      return String(item);
    })
    .filter(Boolean);
}

function normalizeCompareValue(value: unknown): string {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function isMissingCandidateValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function allowedValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeCompareValue).filter(Boolean);
  }
  const scalar = normalizeCompareValue(value);
  return scalar ? [scalar] : [];
}

function evaluateHardRequirement(
  r: HardRequirement,
  answers: Record<string, unknown>,
  cv: Record<string, unknown> | null | undefined,
): { ok: boolean; got: unknown; unevaluable: boolean } {
  const v = answers[r.key] ?? cv?.[r.key];

  if (isMissingCandidateValue(v)) {
    return { ok: false, got: v ?? null, unevaluable: true };
  }

  const n = Number(v);
  const t = Number(r.value);

  if (r.op === 'in') {
    const allowed = allowedValues(r.value);
    const ok = allowed.length > 0 && allowed.includes(normalizeCompareValue(v));
    return { ok, got: v, unevaluable: false };
  }

  if (r.op === '==') {
    const ok = normalizeCompareValue(v) === normalizeCompareValue(r.value);
    return { ok, got: v, unevaluable: false };
  }

  if (r.op === '>=') {
    return { ok: !Number.isNaN(n) && n >= t, got: v, unevaluable: false };
  }

  if (r.op === '<=') {
    return { ok: !Number.isNaN(n) && n <= t, got: v, unevaluable: false };
  }

  if (r.op === 'truthy') {
    const ok = v === true || v === 'true' || v === 'yes';
    return { ok, got: v, unevaluable: false };
  }

  return { ok: true, got: v, unevaluable: false };
}

export function evaluateHardRequirements(
  job: { hard_requirements: unknown },
  answers: Record<string, unknown>,
  cv: Record<string, unknown> | null | undefined,
): HardRequirementFailure[] {
  const fails: HardRequirementFailure[] = [];
  const requirements = Array.isArray(job.hard_requirements)
    ? (job.hard_requirements as HardRequirement[])
    : [];

  for (const r of requirements) {
    if (!r || typeof r !== 'object' || typeof r.key !== 'string') continue;
    const { ok, got, unevaluable } = evaluateHardRequirement(r, answers, cv);
    if (ok) continue;

    const configuredOnFail = r.on_fail === 'RECOMMEND_REJECT' ? 'RECOMMEND_REJECT' : 'MANUAL_REVIEW';
    fails.push({
      key: r.key,
      label: r.label,
      required: r.value,
      got: got ?? null,
      on_fail: unevaluable ? 'MANUAL_REVIEW' : configuredOnFail,
      unevaluable,
    });
  }
  return fails;
}

export function rejectableHardFailures(failures: HardRequirementFailure[]): HardRequirementFailure[] {
  return failures.filter((fail) => fail.on_fail === 'RECOMMEND_REJECT' && !fail.unevaluable);
}

async function loadAnswers(applicationId: string): Promise<Record<string, unknown>> {
  const meta = await one<{
    years_experience: number | null;
    expected_salary: number | null;
    notice_period_days: number | null;
    available_from: string | null;
    current_position: string | null;
    employment_status: string | null;
    age: number | null;
    military_status: string | null;
    marital_status: string | null;
  }>(
    `SELECT
       a.years_experience, a.expected_salary, a.notice_period_days,
       a.available_from, a.current_position, a.employment_status,
       c.age, c.military_status, c.marital_status
     FROM HRSYSTEM_applications a
     JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
     WHERE a.id = $1`,
    [applicationId],
  );

  const answers: Record<string, unknown> = {};

  if (meta) {
    if (meta.age != null) answers.age = meta.age;
    if (meta.military_status != null) answers.military_status = meta.military_status;
    if (meta.marital_status != null) answers.marital_status = meta.marital_status;
    if (meta.years_experience != null) answers.years_experience = meta.years_experience;
    if (meta.expected_salary != null) answers.expected_salary = meta.expected_salary;
    if (meta.notice_period_days != null) answers.notice_period_days = meta.notice_period_days;
    if (meta.available_from != null) answers.available_from = meta.available_from;
    if (meta.current_position != null) answers.current_position = meta.current_position;
    if (meta.employment_status != null) answers.employment_status = meta.employment_status;
  }

  const rows = await query<{ question_key: string; answer: unknown }>(
    `SELECT question_key, answer FROM HRSYSTEM_application_answers WHERE application_id = $1`,
    [applicationId],
  );
  for (const row of rows) answers[row.question_key] = row.answer;

  return answers;
}

export async function runCvParseAndScreening(applicationId: string): Promise<void> {
  try {
    const application = await one<Application>(
      `SELECT * FROM HRSYSTEM_applications WHERE id = $1`,
      [applicationId],
    );
    if (!application) return;

    const job = await one<Job>(`SELECT * FROM HRSYSTEM_jobs WHERE id = $1`, [application.job_id]);
    if (!job) return;

    const document = await one<Document>(
      `SELECT * FROM HRSYSTEM_documents
       WHERE application_id = $1 AND doc_type = 'CV'
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId],
    );

    let parsed: Record<string, unknown> | null = asRecord(document?.parsed);

    if (document && document.parse_status === 'PENDING') {
      const format = (document.format ?? '').toLowerCase();
      if (format !== 'pdf') {
        await one(
          `UPDATE HRSYSTEM_documents SET parse_status = 'MANUAL' WHERE id = $1`,
          [document.id],
        );
      } else {
        try {
          const { url } = signedDeliveryUrl(document.public_id, document.resource_type, format);
          const result = await runAutomation<CvParseData>('cv.parse', { cv_url: url });
          if (result.ok) {
            parsed = asRecord(result.data.parsed);
            await one(
              `UPDATE HRSYSTEM_documents
               SET raw_text = $1, parsed = $2::jsonb, parse_status = 'DONE'
               WHERE id = $3`,
              [result.data.raw_text, JSON.stringify(result.data.parsed ?? {}), document.id],
            );
          } else {
            console.error('cv.parse failed', applicationId, result.error.message);
            await insertWorkflowError({
              action: 'cv.parse',
              node: 'screening',
              error_message: result.error.message,
              application_id: applicationId,
              candidate_id: application.candidate_id,
            });
            await one(
              `UPDATE HRSYSTEM_documents SET parse_status = 'FAILED' WHERE id = $1`,
              [document.id],
            );
          }
        } catch (error) {
          console.error('cv.parse failed', applicationId, error);
          await one(
            `UPDATE HRSYSTEM_documents SET parse_status = 'FAILED' WHERE id = $1`,
            [document.id],
          );
        }
      }
    }

    const answers = await loadAnswers(applicationId);
    const hardFails = evaluateHardRequirements(job, answers, parsed);
    const rejectableHardFails = rejectableHardFailures(hardFails);
    const rejectHardFail = rejectableHardFails.length > 0;

    const settings = await getAppSettings();
    const { cutOff: shortlistMinScore, usedJobThreshold } = resolveShortlistCutOff(
      job.shortlist_threshold,
      settings.auto_shortlist_min_score,
    );

    let score: number | null = null;
    let decision: Recommendation = rejectHardFail ? 'RECOMMEND_REJECT' : 'MANUAL_REVIEW';
    let confidence: number | null = null;
    let strengths: unknown[] = [];
    let weaknesses: unknown[] = [];
    let missing = hardFails.filter((fail) => !fail.unevaluable).map((fail) => fail.label);
    let reasoning = 'Screening automation unavailable; queued for manual review.';
    let rawResponse: unknown = { error: 'screening.run was not called or failed' };

    try {
      const result = await runAutomation<ScreeningRunData>('screening.run', {
        job: {
          title: job.title,
          description: job.description,
          required_skills: job.required_skills,
          min_experience_years: job.min_experience_years,
          education_requirement: job.education_requirement,
          soft_requirements: job.soft_requirements,
          screening_weights: job.screening_weights,
          shortlist_threshold: shortlistMinScore,
        },
        candidate_answers: answers,
        cv_parsed: parsed,
        hard_requirement_failures: hardFails,
      });

      if (result.ok) {
        score = Number.isFinite(result.data.score) ? Math.round(result.data.score) : null;
        decision = asRecommendation(result.data.decision);
        confidence = Number.isFinite(result.data.confidence) ? result.data.confidence : null;
        strengths = Array.isArray(result.data.strengths) ? result.data.strengths : [];
        weaknesses = Array.isArray(result.data.weaknesses) ? result.data.weaknesses : [];
        missing = [
          ...new Set([
            ...asStringList(result.data.missing_requirements),
            ...hardFails.filter((f) => !f.unevaluable).map((f) => f.label),
          ]),
        ];
        reasoning = result.data.reasoning_summary || reasoning;
        rawResponse = {
          ...result.data,
          hard_requirement_failures: hardFails,
        };

        // Apply the resolved shortlist cut-off as the auto-advance recommendation gate.
        if (score !== null && decision !== 'RECOMMEND_REJECT') {
          if (score >= shortlistMinScore && decision === 'MANUAL_REVIEW') {
            decision = 'SHORTLIST';
          } else if (
            score < shortlistMinScore &&
            (decision === 'SHORTLIST' || decision === 'STRONG_SHORTLIST')
          ) {
            decision = 'MANUAL_REVIEW';
          }
        }
      } else {
        console.error('screening.run failed', applicationId, result.error.message);
        await insertWorkflowError({
          action: 'screening.run',
          node: 'screening',
          error_message: result.error.message,
          application_id: applicationId,
          candidate_id: application.candidate_id,
        });
        rawResponse = result.error;
      }
    } catch (error) {
      console.error('screening.run failed', applicationId, error);
      rawResponse = { error: error instanceof Error ? error.message : 'screening.run failed' };
    }

    if (rejectHardFail) decision = 'RECOMMEND_REJECT';
    else if (hardFails.some((fail) => !fail.unevaluable)) decision = 'MANUAL_REVIEW';

    await one(
      `INSERT INTO HRSYSTEM_screening_results (
         application_id, score, recommendation, confidence, strengths, weaknesses,
         missing_requirements, hard_fail, reasoning_summary, model, raw_response
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb)`,
      [
        applicationId,
        score,
        decision,
        confidence,
        JSON.stringify(strengths),
        JSON.stringify(weaknesses),
        JSON.stringify(missing),
        rejectHardFail,
        reasoning,
        'n8n/screening.run',
        JSON.stringify(
          rawResponse && typeof rawResponse === 'object'
            ? { ...(rawResponse as Record<string, unknown>), hard_requirement_failures: hardFails }
            : { hard_requirement_failures: hardFails, screening: rawResponse },
        ),
      ],
    );

    const candidate = await one<{ email: string; full_name: string }>(
      `SELECT email, full_name FROM HRSYSTEM_candidates WHERE id = $1`,
      [application.candidate_id],
    );
    if (!candidate) return;

    const minConfidence = Number(settings.auto_shortlist_min_confidence);

    type AutoOutcome = 'review' | 'reject' | 'shortlist';
    let outcome: AutoOutcome = 'review';
    let reason = 'Awaiting HR review';

    if (rejectHardFail && settings.auto_reject_hard_fail) {
      outcome = 'reject';
      const primary = rejectableHardFails[0];
      reason =
        rejectableHardFails.length === 1 && primary
          ? `${primary.label}: expected ${formatHardRequirementExpected(primary.required)}, got ${formatHardRequirementGot(primary.got)}`
          : `${rejectableHardFails.length} hard requirements failed`;
    } else if (score !== null && score <= settings.auto_reject_max_score) {
      outcome = 'reject';
      reason = `Score ${score} at or below auto-reject threshold (${settings.auto_reject_max_score})`;
    } else if (
      settings.auto_shortlist_enabled &&
      score !== null &&
      score >= shortlistMinScore &&
      confidence !== null &&
      confidence >= minConfidence &&
      !rejectHardFail
    ) {
      outcome = 'shortlist';
      reason = usedJobThreshold
        ? `Score ${score} met this job's shortlist threshold (${shortlistMinScore}) with confidence ${confidence}`
        : `Score ${score} met the default shortlist threshold (${shortlistMinScore}) with confidence ${confidence}`;
    }

    const toStage: Stage =
      outcome === 'reject'
        ? 'INITIAL_REJECTED'
        : outcome === 'shortlist'
          ? 'INITIAL_SHORTLISTED'
          : 'INITIAL_SCREENING_REVIEW';

    await one(
      `UPDATE HRSYSTEM_applications
       SET screening_score = $1,
           stage = $2::HRSYSTEM_app_stage,
           status = CASE WHEN $3 THEN 'REJECTED'::HRSYSTEM_app_status ELSE status END,
           updated_at = now()
       WHERE id = $4
         AND stage IN ('APPLICATION_RECEIVED', 'CV_PROCESSING', 'INITIAL_SCREENING')`,
      [score, toStage, outcome === 'reject', applicationId],
    );

    await appendEvent({
      application_id: applicationId,
      candidate_id: application.candidate_id,
      job_id: application.job_id,
      event_type: 'AI_SCREENING_COMPLETED',
      from_stage: application.stage,
      to_stage: toStage,
      actor_type: 'AI',
      payload: {
        score,
        recommendation: decision,
        hard_fail: rejectHardFail,
        missing_requirements: missing,
      },
    });

    if (outcome === 'reject') {
      await appendEvent({
        application_id: applicationId,
        candidate_id: application.candidate_id,
        job_id: application.job_id,
        event_type: 'AUTO_REJECTED',
        from_stage: application.stage,
        to_stage: toStage,
        actor_type: 'SYSTEM',
        actor_label: 'Automation',
        payload: {
          reason,
          failed_rules: rejectableHardFails.map((fail) => ({
            key: fail.key,
            label: fail.label,
            required: fail.required,
            got: fail.got,
          })),
        },
      });
      await enqueueCommunication({
        candidate_id: application.candidate_id,
        application_id: applicationId,
        template_key: 'REJECTION',
        to_email: candidate.email,
        variables: {
          candidate_name: candidate.full_name,
          job_title: job.title,
          hr_name: 'HR Team',
        },
        dedupe_key: `${applicationId}:AUTO_REJECTION:v1`,
      });
    } else if (outcome === 'shortlist') {
      await appendEvent({
        application_id: applicationId,
        candidate_id: application.candidate_id,
        job_id: application.job_id,
        event_type: 'AUTO_SHORTLISTED',
        from_stage: application.stage,
        to_stage: toStage,
        actor_type: 'SYSTEM',
        actor_label: 'Automation',
        payload: { reason },
      });
      await enqueueCommunication({
        candidate_id: application.candidate_id,
        application_id: applicationId,
        template_key: 'INITIAL_SHORTLIST',
        to_email: candidate.email,
        variables: {
          candidate_name: candidate.full_name,
          job_title: job.title,
          hr_name: 'HR Team',
        },
        dedupe_key: `${applicationId}:AUTO_INITIAL_SHORTLIST:v1`,
      });

      const sendAt = new Date(
        Date.now() + settings.auto_send_assessment_delay_minutes * 60_000,
      );
      await tx(async (client) => {
        const inviteResult = await issueInvite(applicationId, {
          kind: 'ASSESSMENT',
          sendAt,
          actor: { type: 'SYSTEM', label: 'Automation' },
          client,
          autoScheduled: true,
        });
        if (!inviteResult.ok && inviteResult.reason === 'no_assessment') {
          await auditAutoInviteSkipped(client, {
            applicationId,
            candidateId: application.candidate_id,
            jobId: application.job_id,
            stage: 'INITIAL_SHORTLISTED',
            kind: 'ASSESSMENT',
            reason: 'No assessment configured for this job',
            actor: { type: 'SYSTEM', label: 'Automation' },
          });
        }
      });
    }
  } catch (error) {
    console.error('runCvParseAndScreening', applicationId, error);
    try {
      await one(
        `UPDATE HRSYSTEM_applications
         SET stage = 'INITIAL_SCREENING_REVIEW'
         WHERE id = $1
           AND stage IN ('APPLICATION_RECEIVED', 'CV_PROCESSING', 'INITIAL_SCREENING')`,
        [applicationId],
      );
    } catch (stageError) {
      console.error('failed to move application to review', applicationId, stageError);
    }
  }
}
