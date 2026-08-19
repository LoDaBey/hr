import 'server-only';
import { one } from '@/lib/db';
import { gradeAssessment, evaluateTechTest } from '@/lib/pipeline/grading';
import { hasSuccessfulGrading } from '@/lib/pipeline/sweep';
import { appendEvent } from '@/lib/repos/events';
import { findGradingErrorForSitting } from '@/lib/repos/workflow-errors';
import type { Stage } from '@/types/domain';

type SittingRow = {
  id: string;
  application_id: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  status: string;
  submitted_at: string | null;
  candidate_id: string;
  job_id: string;
  stage: Stage;
};

export type ManualGradeResult =
  | { ok: true; sitting_id: string }
  | { ok: false; reason: 'not_found' | 'wrong_kind' | 'not_submitted' | 'already_graded' };

export async function findSubmittedSitting(
  applicationId: string,
  kind: 'ASSESSMENT' | 'TECH_TEST',
): Promise<SittingRow | null> {
  return one<SittingRow>(
    `SELECT ca.id, ca.application_id, ca.kind, ca.status, ca.submitted_at,
            a.candidate_id, a.job_id, a.stage
     FROM HRSYSTEM_candidate_assessments ca
     JOIN HRSYSTEM_applications a ON a.id = ca.application_id
     WHERE ca.application_id = $1 AND ca.kind = $2
     ORDER BY ca.created_at DESC
     LIMIT 1`,
    [applicationId, kind],
  );
}

export async function gradeSittingNow(input: {
  applicationId: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  actorLabel: string;
  actorId?: string;
}): Promise<ManualGradeResult> {
  const sitting = await findSubmittedSitting(input.applicationId, input.kind);
  if (!sitting) {
    return { ok: false, reason: 'not_found' };
  }
  if (sitting.kind !== input.kind) {
    return { ok: false, reason: 'wrong_kind' };
  }
  if (sitting.status !== 'SUBMITTED') {
    return { ok: false, reason: 'not_submitted' };
  }
  if (await hasSuccessfulGrading(sitting.id)) {
    return { ok: false, reason: 'already_graded' };
  }

  await appendEvent({
    application_id: sitting.application_id,
    candidate_id: sitting.candidate_id,
    job_id: sitting.job_id,
    event_type: input.kind === 'TECH_TEST' ? 'TECH_TEST_GRADING_RETRIED' : 'GRADING_RETRIED',
    from_stage: sitting.stage,
    actor_type: 'HR',
    actor_id: input.actorId ?? null,
    actor_label: input.actorLabel,
    payload: {
      candidate_assessment_id: sitting.id,
      kind: input.kind,
      source: 'grade-now',
    },
  });

  if (input.kind === 'TECH_TEST') {
    await evaluateTechTest(sitting.id, { expectedStatus: 'SUBMITTED' });
  } else {
    await gradeAssessment(sitting.id, { expectedStatus: 'SUBMITTED' });
  }

  if (await hasSuccessfulGrading(sitting.id)) {
    return { ok: true, sitting_id: sitting.id };
  }

  const message =
    (await findGradingErrorForSitting(sitting.application_id, sitting.id)) ??
    'Grading did not complete';

  throw new Error(message);
}
