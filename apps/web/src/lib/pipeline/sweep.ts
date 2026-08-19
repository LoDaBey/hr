import 'server-only';
import { one, tx } from '@/lib/db';
import { gradeAssessment, evaluateTechTest } from '@/lib/pipeline/grading';
import { runCvParseAndScreening } from '@/lib/pipeline/screening';
import { appendEvent } from '@/lib/repos/events';
import { insertWorkflowError } from '@/lib/repos/workflow-errors';
import type { Stage } from '@/types/domain';

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;

type GradingClaim = {
  id: string;
  application_id: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  grading_attempts: number;
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
};

export type PipelineSweepResult = {
  grading_claimed: number;
  grading_succeeded: number;
  grading_exhausted: number;
  screening_claimed: number;
  screening_succeeded: number;
  screening_exhausted: number;
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

async function claimGradingBatch(limit: number): Promise<GradingClaim[]> {
  return tx(async (client) => {
    const claimed = await client.query<GradingClaim>(
      `SELECT ca.id, ca.application_id, ca.kind, ca.grading_attempts,
              a.candidate_id, a.job_id, a.stage
       FROM HRSYSTEM_candidate_assessments ca
       JOIN HRSYSTEM_applications a ON a.id = ca.application_id
       WHERE ca.status = 'SUBMITTED'
         AND ca.kind IN ('ASSESSMENT', 'TECH_TEST')
         AND ca.submitted_at < now() - interval '3 minutes'
         AND ca.grading_attempts < $1
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
       SET grading_attempts = grading_attempts + 1, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    return claimed.rows.map((row) => ({
      ...row,
      grading_attempts: row.grading_attempts + 1,
    }));
  });
}

async function claimScreeningBatch(limit: number): Promise<ScreeningClaim[]> {
  return tx(async (client) => {
    const claimed = await client.query<ScreeningClaim>(
      `SELECT a.id, a.candidate_id, a.job_id, a.stage, a.screening_attempts
       FROM HRSYSTEM_applications a
       WHERE a.stage IN ('APPLICATION_RECEIVED', 'CV_PROCESSING')
         AND a.created_at < now() - interval '5 minutes'
         AND a.screening_attempts < $1
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
       SET screening_attempts = screening_attempts + 1, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    return claimed.rows.map((row) => ({
      ...row,
      screening_attempts: row.screening_attempts + 1,
    }));
  });
}

async function recordGradingExhausted(claim: GradingClaim): Promise<void> {
  await insertWorkflowError({
    action: 'assessment.grade',
    node: 'pipeline-sweep',
    error_message: `Grading exhausted ${MAX_ATTEMPTS} sweep attempts without success`,
    application_id: claim.application_id,
    candidate_id: claim.candidate_id,
    input_ref: {
      candidate_assessment_id: claim.id,
      kind: claim.kind,
      grading_attempts: claim.grading_attempts,
    },
  });
}

async function recordScreeningExhausted(claim: ScreeningClaim): Promise<void> {
  await insertWorkflowError({
    action: 'screening.run',
    node: 'pipeline-sweep',
    error_message: `Screening exhausted ${MAX_ATTEMPTS} sweep attempts without success`,
    application_id: claim.id,
    candidate_id: claim.candidate_id,
    input_ref: {
      application_id: claim.id,
      screening_attempts: claim.screening_attempts,
    },
  });
}

async function processGradingClaim(claim: GradingClaim): Promise<'succeeded' | 'exhausted' | 'failed'> {
  const reason =
    claim.kind === 'TECH_TEST'
      ? `Tech test grading retried by sweep (attempt ${claim.grading_attempts})`
      : `Grading retried by sweep (attempt ${claim.grading_attempts})`;

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
      attempt: claim.grading_attempts,
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

  if (claim.grading_attempts >= MAX_ATTEMPTS) {
    await recordGradingExhausted(claim);
    return 'exhausted';
  }

  return 'failed';
}

async function processScreeningClaim(
  claim: ScreeningClaim,
): Promise<'succeeded' | 'exhausted' | 'failed'> {
  await appendEvent({
    application_id: claim.id,
    candidate_id: claim.candidate_id,
    job_id: claim.job_id,
    event_type: 'SCREENING_RETRIED',
    from_stage: claim.stage,
    actor_type: 'SYSTEM',
    actor_label: `Screening retried by sweep (attempt ${claim.screening_attempts})`,
    payload: {
      application_id: claim.id,
      attempt: claim.screening_attempts,
      source: 'pipeline-sweep',
    },
  });

  await runCvParseAndScreening(claim.id);

  if (await hasScreeningResult(claim.id)) {
    return 'succeeded';
  }

  if (claim.screening_attempts >= MAX_ATTEMPTS) {
    await recordScreeningExhausted(claim);
    return 'exhausted';
  }

  return 'failed';
}

export async function runPipelineSweep(): Promise<PipelineSweepResult> {
  const result: PipelineSweepResult = {
    grading_claimed: 0,
    grading_succeeded: 0,
    grading_exhausted: 0,
    screening_claimed: 0,
    screening_succeeded: 0,
    screening_exhausted: 0,
  };

  const gradingClaims = await claimGradingBatch(BATCH_SIZE);
  result.grading_claimed = gradingClaims.length;

  for (const claim of gradingClaims) {
    const outcome = await processGradingClaim(claim);
    if (outcome === 'succeeded') result.grading_succeeded += 1;
    if (outcome === 'exhausted') result.grading_exhausted += 1;
  }

  const screeningClaims = await claimScreeningBatch(BATCH_SIZE);
  result.screening_claimed = screeningClaims.length;

  for (const claim of screeningClaims) {
    const outcome = await processScreeningClaim(claim);
    if (outcome === 'succeeded') result.screening_succeeded += 1;
    if (outcome === 'exhausted') result.screening_exhausted += 1;
  }

  return result;
}

export { hasSuccessfulGrading };
