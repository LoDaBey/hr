import 'server-only';
import { signedDeliveryUrl } from '@/lib/cloudinary';
import { one, query, tx } from '@/lib/db';
import type {
  HrApplicationAnswers,
  HrCandidateListRow,
  HrCandidatesDeleteResult,
  HrCandidatesGetResult,
  HrCandidatesListResult,
} from '@/types/api';
import type {
  Application,
  Candidate,
  Communication,
  Interview,
  Job,
  Recommendation,
  RecruitmentEvent,
  RecordingStatus,
  SittingStatus,
  Stage,
  Status,
} from '@/types/domain';

export type HrCandidatesListFilters = {
  job_id: string | null;
  stage: Stage | null;
  status: Status | null;
  min_score: number | null;
  min_experience: number | null;
  q: string | null;
  page: number;
  page_size: number;
};

type ListRow = HrCandidateListRow & { total: number };

export async function listHrCandidates(
  filters: HrCandidatesListFilters,
): Promise<HrCandidatesListResult> {
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(100, Math.max(1, filters.page_size));
  const offset = (page - 1) * pageSize;

  const rows = await query<ListRow>(
    `SELECT a.id AS application_id, c.id AS candidate_id, c.full_name, c.email,
            j.title AS job_title, a.stage, a.status, a.screening_score, a.assessment_score,
            a.techtest_score, a.years_experience, a.created_at, sr.recommendation,
            count(*) OVER() AS total
     FROM HRSYSTEM_applications a
     JOIN HRSYSTEM_candidates c ON c.id = a.candidate_id
     JOIN HRSYSTEM_jobs j ON j.id = a.job_id
     LEFT JOIN LATERAL (
       SELECT recommendation FROM HRSYSTEM_screening_results
       WHERE application_id = a.id ORDER BY created_at DESC LIMIT 1
     ) sr ON true
     WHERE ($1::uuid IS NULL OR a.job_id = $1)
       AND ($2::text IS NULL OR a.stage::text = $2)
       AND ($3::text IS NULL OR a.status::text = $3)
       AND ($4::int  IS NULL OR a.screening_score >= $4)
       AND ($5::numeric IS NULL OR a.years_experience >= $5)
       AND ($6::text IS NULL OR c.full_name ILIKE '%'||$6||'%' OR c.email ILIKE '%'||$6||'%')
     ORDER BY a.created_at DESC
     LIMIT $7 OFFSET $8`,
    [
      filters.job_id,
      filters.stage,
      filters.status,
      filters.min_score,
      filters.min_experience,
      filters.q,
      pageSize,
      offset,
    ],
  );

  const total = rows[0]?.total ?? 0;
  return {
    total: Number(total) || 0,
    page,
    page_size: pageSize,
    rows: rows.map(({ total: _total, ...row }) => row),
  };
}

type AnswerRow = { question_key: string; label: string; answer: unknown };

type JobQuestionRow = {
  key: string;
  label: string;
  order_index: number;
};

function buildApplicationAnswers(
  candidate: Candidate,
  application: Application,
  job: Job,
  answerRows: AnswerRow[],
  jobQuestions: JobQuestionRow[],
): HrApplicationAnswers {
  const answersByKey = new Map(answerRows.map((row) => [row.question_key, row.answer]));

  const questions = jobQuestions.map((q) => {
    const answer = answersByKey.get(q.key) ?? null;
    const answered =
      answer != null &&
      answer !== '' &&
      !(typeof answer === 'string' && answer.trim() === '');
    return {
      question_key: q.key,
      label: q.label,
      answer: answered ? answer : null,
      answered,
    };
  });

  return {
    personal: {
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      country: candidate.country,
      city: candidate.city,
      age: job.ask_age ? candidate.age : null,
      military_status: job.ask_military_status ? candidate.military_status : null,
      marital_status: job.ask_marital_status ? candidate.marital_status : null,
    },
    professional: {
      employment_status: application.employment_status,
      current_company: application.current_company,
      current_position: application.current_position,
      years_experience: application.years_experience,
      expected_salary: application.expected_salary,
      salary_currency: job.currency,
      notice_period_days: application.notice_period_days,
      available_from: application.available_from,
    },
    questions,
  };
}

type CvRow = {
  public_id: string;
  resource_type: string;
  format: string | null;
  parse_status: string;
  parsed: unknown;
  original_name: string | null;
};

type ScreeningRow = {
  score: number | null;
  recommendation: Recommendation | null;
  confidence: number | null;
  strengths: unknown;
  weaknesses: unknown;
  missing_requirements: unknown;
  reasoning_summary: string | null;
  hr_decision: string | null;
};

type AssessmentSittingRow = {
  id: string;
  status: SittingStatus;
  invite_deadline: string;
  duration_minutes: number;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  late: boolean;
  ai_score: number | null;
  ai_max_score: number | null;
  assessment_id: string;
};

type TechTestSittingRow = AssessmentSittingRow & {
  recording_status: RecordingStatus | null;
};

export async function getHrCandidateDetail(
  applicationId: string,
): Promise<HrCandidatesGetResult | null> {
  const application = await one<Application>(
    `SELECT * FROM HRSYSTEM_applications WHERE id = $1`,
    [applicationId],
  );
  if (!application) return null;

  const [
    candidate,
    job,
    answers,
    jobQuestions,
    cvDoc,
    screening,
    assessmentSitting,
    techtestSitting,
    interviews,
    communications,
    timeline,
    assessmentConfigured,
    techtestConfigured,
  ] = await Promise.all([
    one<Candidate>(`SELECT * FROM HRSYSTEM_candidates WHERE id = $1`, [application.candidate_id]),
    one<Job>(`SELECT * FROM HRSYSTEM_jobs WHERE id = $1`, [application.job_id]),
    query<AnswerRow>(
      `SELECT aa.question_key,
              COALESCE(
                jq_by_id.label,
                jq_by_key.label,
                replace(replace(aa.question_key, '_', ' '), '-', ' ')
              ) AS label,
              aa.answer
       FROM HRSYSTEM_application_answers aa
       LEFT JOIN HRSYSTEM_job_questions jq_by_id
         ON jq_by_id.id = aa.question_id
       LEFT JOIN HRSYSTEM_job_questions jq_by_key
         ON jq_by_key.job_id = (
               SELECT job_id FROM HRSYSTEM_applications WHERE id = $1
             )
           AND jq_by_key.key = aa.question_key
       WHERE aa.application_id = $1
       ORDER BY COALESCE(jq_by_id.order_index, jq_by_key.order_index) NULLS LAST, aa.question_key`,
      [applicationId],
    ),
    query<JobQuestionRow>(
      `SELECT key, label, order_index
       FROM HRSYSTEM_job_questions
       WHERE job_id = $1
       ORDER BY order_index ASC, key ASC`,
      [application.job_id],
    ),
    one<CvRow>(
      `SELECT public_id, resource_type, format, parse_status, parsed, original_name
       FROM HRSYSTEM_documents
       WHERE application_id = $1 AND doc_type = 'CV'
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId],
    ),
    one<ScreeningRow>(
      `SELECT score, recommendation, confidence, strengths, weaknesses,
              missing_requirements, reasoning_summary, hr_decision
       FROM HRSYSTEM_screening_results
       WHERE application_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId],
    ),
    one<AssessmentSittingRow>(
      `SELECT id, status, invite_deadline, duration_minutes,
              started_at, expires_at, submitted_at, late, ai_score, ai_max_score, assessment_id
       FROM HRSYSTEM_candidate_assessments
       WHERE application_id = $1
         AND kind = 'ASSESSMENT'
         AND status <> 'CANCELLED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId],
    ),
    one<TechTestSittingRow>(
      `SELECT id, status, invite_deadline, duration_minutes,
              started_at, expires_at, submitted_at, late, ai_score, ai_max_score,
              assessment_id, recording_status
       FROM HRSYSTEM_candidate_assessments
       WHERE application_id = $1
         AND kind = 'TECH_TEST'
         AND status <> 'CANCELLED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [applicationId],
    ),
    query<Interview>(
      `SELECT * FROM HRSYSTEM_interviews WHERE application_id = $1 ORDER BY scheduled_at`,
      [applicationId],
    ),
    query<Communication>(
      `SELECT id, candidate_id, application_id, template_key, to_email, subject,
              variables, status, attempts, last_error, gmail_message_id,
              dedupe_key, scheduled_for, sent_at, created_at
       FROM HRSYSTEM_communications
       WHERE application_id = $1
       ORDER BY created_at DESC, id DESC`,
      [applicationId],
    ),
    query<RecruitmentEvent>(
      `SELECT * FROM HRSYSTEM_recruitment_events
       WHERE application_id = $1
       ORDER BY created_at ASC, id ASC`,
      [applicationId],
    ),
    one<{ id: string }>(
      `SELECT id FROM HRSYSTEM_assessments
       WHERE job_id = $1 AND kind = 'ASSESSMENT' AND is_active = true
       LIMIT 1`,
      [application.job_id],
    ),
    one<{ id: string }>(
      `SELECT id FROM HRSYSTEM_assessments
       WHERE job_id = $1 AND kind = 'TECH_TEST' AND is_active = true
       LIMIT 1`,
      [application.job_id],
    ),
  ]);

  if (!candidate || !job) return null;

  let cv: HrCandidatesGetResult['cv'] = null;
  if (cvDoc) {
    cv = {
      parse_status: cvDoc.parse_status,
      parsed: cvDoc.parsed,
      original_name: cvDoc.original_name ?? 'cv.pdf',
    };
  }

  let assessment: HrCandidatesGetResult['assessment'] = null;
  if (assessmentSitting) {
    const { assessment_id, ...sitting } = assessmentSitting;
    let review: NonNullable<HrCandidatesGetResult['assessment']>['review'] = null;

    if (
      sitting.status === 'SUBMITTED' ||
      application.stage === 'TECH_ASSESSMENT_REVIEW' ||
      application.stage === 'TECH_SHORTLISTED' ||
      application.stage === 'TECH_REJECTED'
    ) {
      const [questions, answerRows, evalRows] = await Promise.all([
        query<{
          id: string;
          order_index: number;
          type: import('@/types/domain').QuestionType;
          prompt: string;
          options: unknown;
          language: string | null;
          max_score: number;
        }>(
          `SELECT id, order_index, type, prompt, options, language, max_score
           FROM HRSYSTEM_assessment_questions
           WHERE assessment_id = $1
           ORDER BY order_index ASC, id ASC`,
          [assessment_id],
        ),
        query<{ question_id: string; answer: unknown }>(
          `SELECT question_id, answer FROM HRSYSTEM_assessment_answers WHERE candidate_assessment_id = $1`,
          [sitting.id],
        ),
        query<{
          question_id: string | null;
          is_overall: boolean;
          score: number | null;
          max_score: number | null;
          correct_concepts: unknown;
          missing_concepts: unknown;
          technical_errors: unknown;
          feedback: string | null;
          confidence: number | null;
        }>(
          `SELECT question_id, is_overall, score, max_score,
                  correct_concepts, missing_concepts, technical_errors, feedback, confidence
           FROM HRSYSTEM_assessment_evaluations
           WHERE candidate_assessment_id = $1`,
          [sitting.id],
        ),
      ]);

      const answersByQ = new Map(answerRows.map((r) => [r.question_id, r.answer]));
      const evalByQ = new Map(
        evalRows.filter((r) => !r.is_overall && r.question_id).map((r) => [r.question_id!, r]),
      );
      const overall = evalRows.find((r) => r.is_overall);

      review = {
        overall_feedback: overall?.feedback ?? null,
        questions: questions.map((q) => {
          const ev = evalByQ.get(q.id);
          return {
            id: q.id,
            order_index: q.order_index,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            language: q.language,
            max_score: q.max_score,
            answer: answersByQ.get(q.id) ?? null,
            evaluation: ev
              ? {
                  score: ev.score,
                  max_score: ev.max_score,
                  correct_concepts: ev.correct_concepts,
                  missing_concepts: ev.missing_concepts,
                  technical_errors: ev.technical_errors,
                  feedback: ev.feedback,
                  confidence: ev.confidence,
                }
              : null,
          };
        }),
      };
    }

    assessment = {
      id: sitting.id,
      status: sitting.status,
      invite_deadline: sitting.invite_deadline,
      duration_minutes: sitting.duration_minutes,
      started_at: sitting.started_at,
      expires_at: sitting.expires_at,
      submitted_at: sitting.submitted_at,
      late: sitting.late,
      ai_score: sitting.ai_score,
      ai_max_score: sitting.ai_max_score,
      review,
    };
  }

  return {
    candidate,
    application,
    job,
    application_answers: buildApplicationAnswers(candidate, application, job, answers, jobQuestions),
    cv,
    screening: screening
      ? {
          score: screening.score,
          recommendation: screening.recommendation,
          confidence: screening.confidence,
          strengths: screening.strengths,
          weaknesses: screening.weaknesses,
          missing_requirements: screening.missing_requirements,
          reasoning_summary: screening.reasoning_summary,
          hr_decision: screening.hr_decision,
        }
      : null,
    assessment,
    techtest: await (async () => {
      if (!techtestSitting) return null;
      const { assessment_id, ...sitting } = techtestSitting;
      let review: NonNullable<HrCandidatesGetResult['techtest']>['review'] = null;

      const showReview =
        sitting.status === 'SUBMITTED' ||
        application.stage === 'RECORDED_TECH_REVIEW' ||
        application.stage === 'RECORDED_TECH_SHORTLISTED' ||
        application.stage === 'RECORDED_TECH_REJECTED' ||
        application.stage.startsWith('FINAL_') ||
        application.stage === 'HIRED' ||
        application.stage === 'OFFER_PENDING' ||
        application.stage === 'SECOND_FINAL_INTERVIEW';

      if (showReview) {
        const [questions, answerRows, evalRows, eventRows, recording] = await Promise.all([
          query<{
            id: string;
            order_index: number;
            type: import('@/types/domain').QuestionType;
            prompt: string;
            options: unknown;
            language: string | null;
            max_score: number;
          }>(
            `SELECT id, order_index, type, prompt, options, language, max_score
             FROM HRSYSTEM_assessment_questions
             WHERE assessment_id = $1
             ORDER BY order_index ASC, id ASC`,
            [assessment_id],
          ),
          query<{ question_id: string; answer: unknown }>(
            `SELECT question_id, answer FROM HRSYSTEM_assessment_answers WHERE candidate_assessment_id = $1`,
            [sitting.id],
          ),
          query<{
            question_id: string | null;
            is_overall: boolean;
            score: number | null;
            max_score: number | null;
            correct_concepts: unknown;
            missing_concepts: unknown;
            technical_errors: unknown;
            feedback: string | null;
            confidence: number | null;
            raw_response: unknown;
          }>(
            `SELECT question_id, is_overall, score, max_score,
                    correct_concepts, missing_concepts, technical_errors, feedback, confidence,
                    raw_response
             FROM HRSYSTEM_assessment_evaluations
             WHERE candidate_assessment_id = $1`,
            [sitting.id],
          ),
          query<{
            id: string;
            event: string;
            severity: import('@/types/domain').ProctoringSeverity;
            occurred_at: string;
            metadata: unknown;
          }>(
            `SELECT id, event, severity, occurred_at, metadata
             FROM HRSYSTEM_proctoring_events
             WHERE candidate_assessment_id = $1
             ORDER BY occurred_at ASC, id ASC`,
            [sitting.id],
          ),
          one<{
            public_id: string;
            format: string | null;
            duration_seconds: number | null;
            started_at: string | null;
            ended_at: string | null;
          }>(
            `SELECT public_id, format, duration_seconds, started_at, ended_at
             FROM HRSYSTEM_recordings
             WHERE candidate_assessment_id = $1
             ORDER BY part_no DESC
             LIMIT 1`,
            [sitting.id],
          ),
        ]);

        const answersByQ = new Map(answerRows.map((r) => [r.question_id, r.answer]));
        const evalByQ = new Map(
          evalRows.filter((r) => !r.is_overall && r.question_id).map((r) => [r.question_id!, r]),
        );
        const overall = evalRows.find((r) => r.is_overall);
        const raw =
          overall?.raw_response && typeof overall.raw_response === 'object'
            ? (overall.raw_response as {
                proctoring_flag?: 'CLEAN' | 'MINOR_FLAGS' | 'REVIEW_RECORDING';
                proctoring_summary?: string;
              })
            : null;

        let recordingPayload: NonNullable<
          NonNullable<HrCandidatesGetResult['techtest']>['review']
        >['recording'] = null;
        if (recording) {
          const format = recording.format || 'webm';
          const signed =
            sitting.recording_status === 'READY'
              ? signedDeliveryUrl(recording.public_id, 'video', format)
              : null;
          recordingPayload = {
            public_id: recording.public_id,
            format: recording.format,
            duration_seconds: recording.duration_seconds,
            started_at: recording.started_at,
            ended_at: recording.ended_at,
            signed_url: signed?.url ?? null,
          };
        }

        review = {
          overall_feedback: overall?.feedback ?? null,
          proctoring_flag: raw?.proctoring_flag ?? null,
          proctoring_summary: raw?.proctoring_summary ?? null,
          recording: recordingPayload,
          events: eventRows,
          questions: questions.map((q) => {
            const ev = evalByQ.get(q.id);
            return {
              id: q.id,
              order_index: q.order_index,
              type: q.type,
              prompt: q.prompt,
              options: q.options,
              language: q.language,
              max_score: q.max_score,
              answer: answersByQ.get(q.id) ?? null,
              evaluation: ev
                ? {
                    score: ev.score,
                    max_score: ev.max_score,
                    correct_concepts: ev.correct_concepts,
                    missing_concepts: ev.missing_concepts,
                    technical_errors: ev.technical_errors,
                    feedback: ev.feedback,
                    confidence: ev.confidence,
                  }
                : null,
            };
          }),
        };
      }

      return {
        id: sitting.id,
        status: sitting.status,
        invite_deadline: sitting.invite_deadline,
        duration_minutes: sitting.duration_minutes,
        started_at: sitting.started_at,
        expires_at: sitting.expires_at,
        submitted_at: sitting.submitted_at,
        late: sitting.late,
        ai_score: sitting.ai_score,
        ai_max_score: sitting.ai_max_score,
        recording_status: sitting.recording_status,
        review,
      };
    })(),
    interviews,
    communications,
    timeline,
    job_has_assessment: Boolean(assessmentConfigured),
    job_has_techtest: Boolean(techtestConfigured),
  };
}

export async function deleteHrCandidateApplication(
  applicationId: string,
): Promise<HrCandidatesDeleteResult> {
  const row = await one<{ id: string; candidate_id: string }>(
    `SELECT id, candidate_id FROM HRSYSTEM_applications WHERE id = $1`,
    [applicationId],
  );
  if (!row) {
    throw Object.assign(new Error('Application not found'), { code: 'NOT_FOUND' });
  }

  const candidateDeleted = await tx(async (client) => {
    await client.query(
      `DELETE FROM HRSYSTEM_candidate_assessments WHERE application_id = $1`,
      [applicationId],
    );
    await client.query(`DELETE FROM HRSYSTEM_applications WHERE id = $1`, [applicationId]);
    const leftover = await client.query<{ remaining: number }>(
      `SELECT count(*)::int AS remaining FROM HRSYSTEM_applications WHERE candidate_id = $1`,
      [row.candidate_id],
    );
    if ((leftover.rows[0]?.remaining ?? 0) > 0) return false;
    await client.query(`DELETE FROM HRSYSTEM_candidates WHERE id = $1`, [row.candidate_id]);
    return true;
  });

  return {
    application_id: applicationId,
    candidate_id: row.candidate_id,
    candidate_deleted: candidateDeleted,
  };
}

