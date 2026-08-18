import 'server-only';
import { signedDeliveryUrl } from '@/lib/cloudinary';
import { runAutomation } from '@/lib/automation';
import { one, query } from '@/lib/db';
import { appendEvent } from '@/lib/repos/events';
import { insertWorkflowError } from '@/lib/repos/workflow-errors';
import type { CvParseData, ScreeningRunData } from '@/types/api';
import type {
  Application,
  Document,
  HardRequirement,
  HardRequirementFailure,
  Job,
  Recommendation,
} from '@/types/domain';

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
    const v = answers[r.key] ?? cv?.[r.key];
    const n = Number(v);
    const t = Number(r.value);
    const ok =
      r.op === '>='
        ? !Number.isNaN(n) && n >= t
        : r.op === '<='
          ? !Number.isNaN(n) && n <= t
          : r.op === '=='
            ? String(v) === String(r.value)
            : r.op === 'truthy'
              ? v === true || v === 'true' || v === 'yes'
              : true;
    if (!ok) {
      fails.push({
        key: r.key,
        label: r.label,
        required: r.value,
        got: v ?? null,
        on_fail: r.on_fail === 'RECOMMEND_REJECT' ? 'RECOMMEND_REJECT' : 'MANUAL_REVIEW',
      });
    }
  }
  return fails;
}

async function loadAnswers(applicationId: string): Promise<Record<string, unknown>> {
  const rows = await query<{ question_key: string; answer: unknown }>(
    `SELECT question_key, answer FROM HRSYSTEM_application_answers WHERE application_id = $1`,
    [applicationId],
  );
  const answers: Record<string, unknown> = {};
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
    const rejectHardFail = hardFails.some((fail) => fail.on_fail === 'RECOMMEND_REJECT');

    let score: number | null = null;
    let decision: Recommendation = rejectHardFail ? 'RECOMMEND_REJECT' : 'MANUAL_REVIEW';
    let confidence: number | null = null;
    let strengths: unknown[] = [];
    let weaknesses: unknown[] = [];
    let missing = hardFails.map((fail) => fail.label);
    let reasoning = 'Screening automation unavailable; queued for manual review.';
    let rawResponse: unknown = { error: 'screening.run was not called or failed' };

    try {
      const result = await runAutomation<ScreeningRunData>('screening.run', {
        job: {
          title: job.title,
          description: job.description,
          required_skills: job.required_skills,
          preferred_skills: job.preferred_skills,
          min_experience_years: job.min_experience_years,
          education_requirement: job.education_requirement,
          soft_requirements: job.soft_requirements,
          screening_weights: job.screening_weights,
          shortlist_threshold: job.shortlist_threshold,
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
          ...new Set([...asStringList(result.data.missing_requirements), ...hardFails.map((f) => f.label)]),
        ];
        reasoning = result.data.reasoning_summary || reasoning;
        rawResponse = result.data;
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
    else if (hardFails.length && decision !== 'RECOMMEND_REJECT') decision = 'MANUAL_REVIEW';

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
        JSON.stringify(rawResponse ?? {}),
      ],
    );

    await one(
      `UPDATE HRSYSTEM_applications
       SET screening_score = $1, stage = 'INITIAL_SCREENING_REVIEW'
       WHERE id = $2
         AND stage IN ('APPLICATION_RECEIVED', 'CV_PROCESSING', 'INITIAL_SCREENING')`,
      [score, applicationId],
    );

    await appendEvent({
      application_id: applicationId,
      candidate_id: application.candidate_id,
      job_id: application.job_id,
      event_type: 'AI_SCREENING_COMPLETED',
      from_stage: application.stage,
      to_stage: 'INITIAL_SCREENING_REVIEW',
      actor_type: 'AI',
      payload: {
        score,
        recommendation: decision,
        hard_fail: rejectHardFail,
        missing_requirements: missing,
      },
    });
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
