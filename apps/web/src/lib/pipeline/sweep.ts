import 'server-only';
import { TASK_TIMEOUT_MS } from '@/lib/automation';
import { one, tx } from '@/lib/db';
import { MAX_ATTEMPTS } from '@/lib/pipeline/constants';
import { gradeAssessment, evaluateTechTest } from '@/lib/pipeline/grading';
import { runCvParseAndScreening } from '@/lib/pipeline/screening';
import { appendEvent } from '@/lib/repos/events';
import { insertWorkflowError } from '@/lib/repos/workflow-errors';
import type { Stage } from '@/types/domain';

const BATCH_SIZE = 2;
/**
 * The sweep runs inside a route whose maxDuration is ROUTE_BUDGET_SECONDS (60s). This
 * budget leaves ~10s of headroom for the claim queries, the event writes and response
 * serialization.
 *
 * INVARIANT: SWEEP_BUDGET_MS must be greater than the most expensive single claim —
 * today `recording.grade` (45s) and `cv.parse` + `screening.run` (45s). If a claim's cost
 * is ever allowed to equal or exceed this budget, that claim defers on every run forever
 * and the candidate is stranded with no attempt counter to exhaust. See T-65.
 */
const SWEEP_BUDGET_MS = 50_000;

type GradingClaim = {
  id: string;
  application_id: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  grading_attempts: number;
  has_spoken: boolean;
  candidate_id: string;
  job_id: string;
  stage: Stage;
};

type ScreeningClaim = {
  id: string;
  candidate_id: string;
  job_id: string;
  stage: Stage;
  screening_attempts: number;
  needs_cv_parse: boolean;
};

export type PipelineSweepResult = {
  grading_claimed: number;
  grading_succeeded: number;
  grading_exhausted: number;
  grading_deferred: number;
  grading_errored: number;
  screening_claimed: number;
  screening_succeeded: number;
  screening_exhausted: number;
  screening_deferred: number;
  screening_errored: number;
  elapsed_ms: number;
};

async function hasSuccessfulGrading(sittingId: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `SELECT id FROM HRSYSTEM_assessment_evaluations
     WHERE candidate_assessment_id = $1
       AND is_overall = true
       AND score IS NOT NULL
       AND (raw_response IS NULL OR raw_response->>'grading_failed' IS DISTINCT FROM 'true')
     LIMIT 1`,
    [sittingId],
  );
  return Boolean(row);
}

async function hasScreeningResult(applicationId: string): Promise<boolean> {
  const row = await one<{ id: string }>(
    `SELECT id FROM HRSYSTEM_screening_results WHERE application_id = $1 LIMIT 1`,
    [applicationId],
  );
  return Boolean(row);
}

function gradingTimeoutMs(claim: GradingClaim): number {
  if (claim.kind === 'TECH_TEST' && claim.has_spoken) {
    return TASK_TIMEOUT_MS['recording.grade'];
  }
  return TASK_TIMEOUT_MS['assessment.grade'];
}

function screeningTimeoutMs(claim: ScreeningClaim): number {
  // Sum of the automations this claim will invoke.
  if (claim.needs_cv_parse) {
    return TASK_TIMEOUT_MS['cv.parse'] + TASK_TIMEOUT_MS['screening.run'];
  }
  return TASK_TIMEOUT_MS['screening.run'];
}

async function releaseGradingLease(sittingId: string): Promise<void> {
  await one(
    `UPDATE HRSYSTEM_candidate_assessments
     SET grading_claimed_at = NULL, updated_at = now()
     WHERE id = $1`,
    [sittingId],
  );
}

async function releaseScreeningLease(applicationId: string): Promise<void> {
  await one(
    `UPDATE HRSYSTEM_applications
     SET screening_claimed_at = NULL, updated_at = now()
     WHERE id = $1`,
    [applicationId],
  );
}

async function claimGradingBatch(limit: number): Promise<GradingClaim[]> {
  return tx(async (client) => {
    const claimed = await client.query<GradingClaim>(
      `SELECT ca.id, ca.application_id, ca.kind, ca.grading_attempts,
              a.candidate_id, a.job_id, a.stage,
              EXISTS (
                SELECT 1 FROM HRSYSTEM_assessment_questions q
                WHERE q.assessment_id = ca.assessment_id
                  AND q.answer_mode = 'spoken'
              ) AS has_spoken
       FROM HRSYSTEM_candidate_assessments ca
       JOIN HRSYSTEM_applications a ON a.id = ca.application_id
       WHERE ca.status = 'SUBMITTED'
         AND ca.kind IN ('ASSESSMENT', 'TECH_TEST')
         AND ca.submitted_at < now() - interval '3 minutes'
         AND ca.grading_attempts < $1
         AND (ca.grading_claimed_at IS NULL
              OR ca.grading_claimed_at < now() - interval '10 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM HRSYSTEM_assessment_evaluations ae
           WHERE ae.candidate_assessment_id = ca.id
             AND ae.is_overall = true
             AND ae.score IS NOT NULL
             AND (ae.raw_response IS NULL OR ae.raw_response->>'grading_failed' IS DISTINCT FROM 'true')
         )
       FOR UPDATE OF ca SKIP LOCKED
       LIMIT $2`,
      [MAX_ATTEMPTS, limit],
    );
    if (claimed.rows.length === 0) return [];

    const ids = claimed.rows.map((row) => row.id);
    await client.query(
      `UPDATE HRSYSTEM_candidate_assessments
       SET grading_claimed_at = now(), updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    return claimed.rows;
  });
}

async function claimScreeningBatch(limit: number): Promise<ScreeningClaim[]> {
  return tx(async (client) => {
    const claimed = await client.query<ScreeningClaim>(
      `SELECT a.id, a.candidate_id, a.job_id, a.stage, a.screening_attempts,
              EXISTS (
                SELECT 1 FROM HRSYSTEM_documents d
                WHERE d.application_id = a.id
                  AND d.doc_type = 'CV'
                  AND d.parse_status = 'PENDING'
                  AND lower(coalesce(d.format, '')) IN ('pdf', 'docx')
              ) AS needs_cv_parse
       FROM HRSYSTEM_applications a
       WHERE a.stage IN ('APPLICATION_RECEIVED', 'CV_PROCESSING')
         AND a.created_at < now() - interval '5 minutes'
         AND a.screening_attempts < $1
         AND (a.screening_claimed_at IS NULL
              OR a.screening_claimed_at < now() - interval '10 minutes')
         AND NOT EXISTS (
           SELECT 1 FROM HRSYSTEM_screening_results sr WHERE sr.application_id = a.id
         )
       FOR UPDATE OF a SKIP LOCKED
       LIMIT $2`,
      [MAX_ATTEMPTS, limit],
    );
    if (claimed.rows.length === 0) return [];

    const ids = claimed.rows.map((row) => row.id);
    await client.query(
      `UPDATE HRSYSTEM_applications
       SET screening_claimed_at = now(), updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    return claimed.rows;
  });
}

async function processGradingClaim(
  claim: GradingClaim,
): Promise<'succeeded' | 'exhausted' | 'failed'> {
  const nextAttempt = claim.grading_attempts + 1;
  const reason =
    claim.kind === 'TECH_TEST'
      ? `Tech test grading retried by sweep (attempt ${nextAttempt})`
      : `Grading retried by sweep (attempt ${nextAttempt})`;

  await appendEvent({
    application_id: claim.application_id,
    candidate_id: claim.candidate_id,
    job_id: claim.job_id,
    event_type: claim.kind === 'TECH_TEST' ? 'TECH_TEST_GRADING_RETRIED' : 'GRADING_RETRIED',
    from_stage: claim.stage,
    actor_type: 'SYSTEM',
    actor_label: reason,
    payload: {
      candidate_assessment_id: claim.id,
      kind: claim.kind,
      attempt: nextAttempt,
      source: 'pipeline-sweep',
    },
  });

  if (claim.kind === 'TECH_TEST') {
    await evaluateTechTest(claim.id, { expectedStatus: 'SUBMITTED' });
  } else {
    await gradeAssessment(claim.id, { expectedStatus: 'SUBMITTED' });
  }

  if (await hasSuccessfulGrading(claim.id)) {
    return 'succeeded';
  }

  const after = await one<{ grading_attempts: number }>(
    `SELECT grading_attempts FROM HRSYSTEM_candidate_assessments WHERE id = $1`,
    [claim.id],
  );
  if ((after?.grading_attempts ?? 0) >= MAX_ATTEMPTS) {
    return 'exhausted';
  }

  await releaseGradingLease(claim.id);
  return 'failed';
}

async function processScreeningClaim(
  claim: ScreeningClaim,
): Promise<'succeeded' | 'exhausted' | 'failed'> {
  const nextAttempt = claim.screening_attempts + 1;
  await appendEvent({
    application_id: claim.id,
    candidate_id: claim.candidate_id,
    job_id: claim.job_id,
    event_type: 'SCREENING_RETRIED',
    from_stage: claim.stage,
    actor_type: 'SYSTEM',
    actor_label: `Screening retried by sweep (attempt ${nextAttempt})`,
    payload: {
      application_id: claim.id,
      attempt: nextAttempt,
      source: 'pipeline-sweep',
    },
  });

  await runCvParseAndScreening(claim.id);

  if (await hasScreeningResult(claim.id)) {
    return 'succeeded';
  }

  const after = await one<{ screening_attempts: number }>(
    `SELECT screening_attempts FROM HRSYSTEM_applications WHERE id = $1`,
    [claim.id],
  );
  if ((after?.screening_attempts ?? 0) >= MAX_ATTEMPTS) {
    return 'exhausted';
  }

  // No result and no definite failure recorded inside screening — release lease so the
  // next sweep can retry without waiting for lease expiry.
  await releaseScreeningLease(claim.id);
  return 'failed';
}

export async function runPipelineSweep(): Promise<PipelineSweepResult> {
  const startedAt = Date.now();
  const result: PipelineSweepResult = {
    grading_claimed: 0,
    grading_succeeded: 0,
    grading_exhausted: 0,
    grading_deferred: 0,
    grading_errored: 0,
    screening_claimed: 0,
    screening_succeeded: 0,
    screening_exhausted: 0,
    screening_deferred: 0,
    screening_errored: 0,
    elapsed_ms: 0,
  };

  const gradingClaims = await claimGradingBatch(BATCH_SIZE);
  result.grading_claimed = gradingClaims.length;

  // Shared across both loops: the first claim always runs; later claims defer when the
  // remaining budget cannot cover their cost.
  let processed = 0;

  for (const claim of gradingClaims) {
    const remaining = SWEEP_BUDGET_MS - (Date.now() - startedAt);
    const needed = gradingTimeoutMs(claim);
    if (processed > 0 && remaining < needed) {
      await releaseGradingLease(claim.id);
      result.grading_deferred += 1;
      console.info(
        `[pipeline-sweep] deferred grading sitting=${claim.id} kind=${claim.kind} needed_ms=${needed} remaining_ms=${remaining}`,
      );
      continue;
    }

    processed += 1;
    try {
      const outcome = await processGradingClaim(claim);
      if (outcome === 'succeeded') result.grading_succeeded += 1;
      if (outcome === 'exhausted') result.grading_exhausted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await insertWorkflowError({
        action: 'assessment.grade',
        node: 'pipeline-sweep',
        error_message: message,
        application_id: claim.application_id,
        candidate_id: claim.candidate_id,
        input_ref: { candidate_assessment_id: claim.id, kind: claim.kind },
      });
      await releaseGradingLease(claim.id);
      result.grading_errored += 1;
      console.error(
        `[pipeline-sweep] grading claim threw sitting=${claim.id} kind=${claim.kind}: ${message}`,
      );
    }
  }

  const screeningClaims = await claimScreeningBatch(BATCH_SIZE);
  result.screening_claimed = screeningClaims.length;

  for (const claim of screeningClaims) {
    const remaining = SWEEP_BUDGET_MS - (Date.now() - startedAt);
    const needed = screeningTimeoutMs(claim);
    if (processed > 0 && remaining < needed) {
      await releaseScreeningLease(claim.id);
      result.screening_deferred += 1;
      console.info(
        `[pipeline-sweep] deferred screening application=${claim.id} needed_ms=${needed} remaining_ms=${remaining}`,
      );
      continue;
    }

    processed += 1;
    try {
      const outcome = await processScreeningClaim(claim);
      if (outcome === 'succeeded') result.screening_succeeded += 1;
      if (outcome === 'exhausted') result.screening_exhausted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await insertWorkflowError({
        action: 'screening.run',
        node: 'pipeline-sweep',
        error_message: message,
        application_id: claim.id,
        candidate_id: claim.candidate_id,
        input_ref: { application_id: claim.id },
      });
      await releaseScreeningLease(claim.id);
      result.screening_errored += 1;
      console.error(
        `[pipeline-sweep] screening claim threw application=${claim.id}: ${message}`,
      );
    }
  }

  result.elapsed_ms = Date.now() - startedAt;
  return result;
}

export { hasSuccessfulGrading };
