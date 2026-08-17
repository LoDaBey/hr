import 'server-only';
import { runAutomation } from '@/lib/automation';
import { one, query, tx } from '@/lib/db';
import type { AssessmentGradeData, AssessmentGradeResultItem } from '@/types/api';
import type { QuestionType, Stage } from '@/types/domain';

type SittingRow = {
  id: string;
  application_id: string;
  assessment_id: string;
  kind: 'ASSESSMENT' | 'TECH_TEST';
  status: string;
  candidate_id: string;
  job_id: string;
  stage: Stage;
};

type QuestionRow = {
  id: string;
  type: QuestionType;
  prompt: string;
  correct_key: string | null;
  rubric: string | null;
  max_score: number;
  order_index: number;
};

type AnswerRow = {
  question_id: string;
  answer: unknown;
};

type PerQuestionEval = {
  question_id: string;
  score: number;
  max_score: number;
  correct_concepts: unknown[];
  missing_concepts: unknown[];
  technical_errors: unknown[];
  feedback: string;
  confidence: number | null;
  raw_response: unknown;
};

function answerText(answer: unknown): string {
  if (answer == null) return '';
  if (typeof answer === 'string') return answer.trim();
  if (typeof answer === 'object') {
    const row = answer as { text?: unknown; key?: unknown };
    if (typeof row.text === 'string') return row.text.trim();
    if (typeof row.key === 'string') return row.key.trim();
  }
  return String(answer).trim();
}

function answerKey(answer: unknown): string | null {
  if (answer == null) return null;
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'object' && answer !== null && 'key' in answer) {
    const key = (answer as { key: unknown }).key;
    return key == null ? null : String(key);
  }
  return null;
}

function isAnswered(answer: unknown): boolean {
  return answerText(answer) !== '' || answerKey(answer) != null;
}

function scoreMcq(question: QuestionRow, answer: unknown): PerQuestionEval {
  const max = Number(question.max_score) || 0;
  if (!isAnswered(answer)) {
    return {
      question_id: question.id,
      score: 0,
      max_score: max,
      correct_concepts: [],
      missing_concepts: [],
      technical_errors: [],
      feedback: 'No answer submitted',
      confidence: 1,
      raw_response: { scored: 'mcq', unanswered: true },
    };
  }
  const key = answerKey(answer);
  const correct = key != null && question.correct_key != null && key === question.correct_key;
  return {
    question_id: question.id,
    score: correct ? max : 0,
    max_score: max,
    correct_concepts: correct ? ['Selected correct option'] : [],
    missing_concepts: correct ? [] : ['Incorrect option selected'],
    technical_errors: [],
    feedback: correct ? 'Correct' : 'Incorrect',
    confidence: 1,
    raw_response: { scored: 'mcq', selected: key, correct_key: question.correct_key },
  };
}

function unansweredEval(question: QuestionRow): PerQuestionEval {
  return {
    question_id: question.id,
    score: 0,
    max_score: Number(question.max_score) || 0,
    correct_concepts: [],
    missing_concepts: [],
    technical_errors: [],
    feedback: 'No answer submitted',
    confidence: 1,
    raw_response: { unanswered: true },
  };
}

function mapAiResult(
  question: QuestionRow,
  item: AssessmentGradeResultItem | undefined,
): PerQuestionEval {
  if (!item) {
    return {
      question_id: question.id,
      score: 0,
      max_score: Number(question.max_score) || 0,
      correct_concepts: [],
      missing_concepts: [],
      technical_errors: [],
      feedback: 'AI grading unavailable — please review manually',
      confidence: null,
      raw_response: null,
    };
  }
  return {
    question_id: question.id,
    score: Number(item.score) || 0,
    max_score: Number(item.max_score) || Number(question.max_score) || 0,
    correct_concepts: item.correct_concepts ?? [],
    missing_concepts: item.missing_concepts ?? [],
    technical_errors: item.technical_errors ?? [],
    feedback: item.feedback || '',
    confidence: item.confidence ?? null,
    raw_response: item,
  };
}

export async function gradeAssessment(sittingId: string): Promise<void> {
  const sitting = await one<SittingRow>(
    `SELECT ca.id, ca.application_id, ca.assessment_id, ca.kind, ca.status,
            a.candidate_id, a.job_id, a.stage
     FROM candidate_assessments ca
     JOIN applications a ON a.id = ca.application_id
     WHERE ca.id = $1`,
    [sittingId],
  );
  if (!sitting) {
    console.error('[grading] sitting not found', sittingId);
    return;
  }
  if (sitting.status !== 'SUBMITTED') {
    console.info('[grading] skip — sitting not SUBMITTED', sittingId, sitting.status);
    return;
  }

  const questions = await query<QuestionRow>(
    `SELECT id, type, prompt, correct_key, rubric, max_score, order_index
     FROM assessment_questions
     WHERE assessment_id = $1
     ORDER BY order_index ASC, id ASC`,
    [sitting.assessment_id],
  );

  const answerRows = await query<AnswerRow>(
    `SELECT question_id, answer FROM assessment_answers WHERE candidate_assessment_id = $1`,
    [sittingId],
  );
  const answersByQ = new Map(answerRows.map((r) => [r.question_id, r.answer]));

  const mcqEvals: PerQuestionEval[] = [];
  const openForAi: Array<{
    question: QuestionRow;
    answer: unknown;
  }> = [];
  const unansweredOpen: PerQuestionEval[] = [];

  for (const q of questions) {
    const answer = answersByQ.get(q.id);
    if (q.type === 'MCQ') {
      mcqEvals.push(scoreMcq(q, answer));
      continue;
    }
    if (!isAnswered(answer)) {
      unansweredOpen.push(unansweredEval(q));
      continue;
    }
    openForAi.push({ question: q, answer });
  }

  let aiFailed = false;
  const aiByQuestion = new Map<string, AssessmentGradeResultItem>();

  if (openForAi.length > 0) {
    const result = await runAutomation<AssessmentGradeData>('assessment.grade', {
      questions: openForAi.map(({ question, answer }) => ({
        question_id: question.id,
        type: question.type,
        prompt: question.prompt,
        rubric: question.rubric,
        max_score: question.max_score,
        answer,
      })),
    });

    if (!result.ok || !result.data?.results) {
      aiFailed = true;
      console.error('[grading] assessment.grade failed', result);
    } else {
      for (const item of result.data.results) {
        aiByQuestion.set(item.question_id, item);
      }
    }
  }

  const openEvals: PerQuestionEval[] = openForAi.map(({ question }) => {
    if (aiFailed) {
      return {
        question_id: question.id,
        score: 0,
        max_score: Number(question.max_score) || 0,
        correct_concepts: [],
        missing_concepts: [],
        technical_errors: [],
        feedback: 'AI grading unavailable — please review manually',
        confidence: null,
        raw_response: null,
      };
    }
    return mapAiResult(question, aiByQuestion.get(question.id));
  });

  const allEvals = [...mcqEvals, ...unansweredOpen, ...openEvals];
  const sumScore = allEvals.reduce((s, e) => s + e.score, 0);
  const sumMax = allEvals.reduce((s, e) => s + e.max_score, 0);
  const totalPct = sumMax > 0 ? Math.round((sumScore / sumMax) * 1000) / 10 : 0;

  const overallFeedback = aiFailed
    ? 'AI grading unavailable — please review manually'
    : `Scored ${sumScore} / ${sumMax} (${totalPct}%)`;

  await tx(async (client) => {
    await client.query(`DELETE FROM assessment_evaluations WHERE candidate_assessment_id = $1`, [
      sittingId,
    ]);

    for (const ev of allEvals) {
      await client.query(
        `INSERT INTO assessment_evaluations (
           candidate_assessment_id, question_id, is_overall,
           score, max_score, correct_concepts, missing_concepts, technical_errors,
           feedback, confidence, model, raw_response
         ) VALUES (
           $1, $2, false,
           $3, $4, $5::jsonb, $6::jsonb, $7::jsonb,
           $8, $9, $10, $11::jsonb
         )`,
        [
          sittingId,
          ev.question_id,
          ev.score,
          ev.max_score,
          JSON.stringify(ev.correct_concepts),
          JSON.stringify(ev.missing_concepts),
          JSON.stringify(ev.technical_errors),
          ev.feedback,
          ev.confidence,
          aiFailed ? null : 'assessment.grade',
          ev.raw_response == null ? null : JSON.stringify(ev.raw_response),
        ],
      );
    }

    await client.query(
      `INSERT INTO assessment_evaluations (
         candidate_assessment_id, question_id, is_overall,
         score, max_score, correct_concepts, missing_concepts, technical_errors,
         feedback, confidence, model, raw_response
       ) VALUES (
         $1, NULL, true,
         $2, $3, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
         $4, $5, $6, $7::jsonb
       )`,
      [
        sittingId,
        sumScore,
        sumMax,
        overallFeedback,
        aiFailed ? null : 1,
        aiFailed ? null : 'assessment.grade',
        JSON.stringify({ total_pct: totalPct, ai_failed: aiFailed }),
      ],
    );

    await client.query(
      `UPDATE candidate_assessments
       SET ai_score = $2, ai_max_score = $3, updated_at = now()
       WHERE id = $1`,
      [sittingId, Math.round(totalPct), 100],
    );

    await client.query(
      `UPDATE applications
       SET assessment_score = $2,
           stage = 'TECH_ASSESSMENT_REVIEW'::app_stage,
           updated_at = now()
       WHERE id = $1`,
      [sitting.application_id, Math.round(totalPct)],
    );

    await client.query(
      `INSERT INTO recruitment_events (
         application_id, candidate_id, job_id, event_type,
         from_stage, to_stage, actor_type, actor_label, payload
       ) VALUES (
         $1, $2, $3, 'ASSESSMENT_EVALUATED',
         $4::app_stage, 'TECH_ASSESSMENT_REVIEW'::app_stage,
         'AI', 'assessment.grade', $5::jsonb
       )`,
      [
        sitting.application_id,
        sitting.candidate_id,
        sitting.job_id,
        sitting.stage,
        JSON.stringify({
          candidate_assessment_id: sittingId,
          ai_score: Math.round(totalPct),
          ai_failed: aiFailed,
        }),
      ],
    );
  });
}

type ProctoringFlag = 'CLEAN' | 'MINOR_FLAGS' | 'REVIEW_RECORDING';

type ProctorAgg = {
  event: string;
  severity: string;
  n: number;
  first_at: string;
  last_at: string;
};

function proctoringFlag(rows: ProctorAgg[]): {
  flag: ProctoringFlag;
  summary: string;
  critical_timestamps: Array<{ event: string; at: string }>;
} {
  const critical = rows.filter((r) => r.severity === 'CRITICAL');
  const warnCount = rows
    .filter((r) => r.severity === 'WARN')
    .reduce((s, r) => s + Number(r.n), 0);

  let flag: ProctoringFlag = 'CLEAN';
  if (critical.length > 0) flag = 'REVIEW_RECORDING';
  else if (warnCount > 5) flag = 'MINOR_FLAGS';

  const parts: string[] = [];
  for (const row of rows) {
    if (row.severity === 'INFO') continue;
    const label =
      row.event === 'TAB_CHANGED'
        ? 'tab change'
        : row.event === 'FULLSCREEN_EXIT'
          ? 'fullscreen exit'
          : row.event === 'CONNECTION_LOST'
            ? 'connection loss'
            : row.event === 'CAMERA_OFF'
              ? 'camera off'
              : row.event === 'MIC_OFF'
                ? 'microphone off'
                : row.event.toLowerCase().replaceAll('_', ' ');
    parts.push(`${row.n} ${label}${Number(row.n) === 1 ? '' : 's'}`);
  }

  const flagCount = rows
    .filter((r) => r.severity !== 'INFO')
    .reduce((s, r) => s + Number(r.n), 0);

  const summary =
    parts.length === 0
      ? 'No proctoring flags.'
      : `${flagCount} flag${flagCount === 1 ? '' : 's'}: ${parts.join(', ')}`;

  const critical_timestamps = critical.flatMap((r) => [
    { event: r.event, at: r.first_at },
    ...(r.first_at !== r.last_at ? [{ event: r.event, at: r.last_at }] : []),
  ]);

  return { flag, summary, critical_timestamps };
}

/** Reuses the T-23 grader; proctoring summary is descriptive only and never changes the score. */
export async function evaluateTechTest(sittingId: string): Promise<void> {
  const sitting = await one<SittingRow>(
    `SELECT ca.id, ca.application_id, ca.assessment_id, ca.kind, ca.status,
            a.candidate_id, a.job_id, a.stage
     FROM candidate_assessments ca
     JOIN applications a ON a.id = ca.application_id
     WHERE ca.id = $1`,
    [sittingId],
  );
  if (!sitting) {
    console.error('[evaluateTechTest] sitting not found', sittingId);
    return;
  }
  if (sitting.kind !== 'TECH_TEST') {
    console.error('[evaluateTechTest] wrong kind', sitting.kind);
    return;
  }
  if (sitting.status !== 'SUBMITTED') {
    console.info('[evaluateTechTest] skip — not SUBMITTED', sittingId, sitting.status);
    return;
  }

  const questions = await query<QuestionRow>(
    `SELECT id, type, prompt, correct_key, rubric, max_score, order_index
     FROM assessment_questions
     WHERE assessment_id = $1
     ORDER BY order_index ASC, id ASC`,
    [sitting.assessment_id],
  );

  const answerRows = await query<AnswerRow>(
    `SELECT question_id, answer FROM assessment_answers WHERE candidate_assessment_id = $1`,
    [sittingId],
  );
  const answersByQ = new Map(answerRows.map((r) => [r.question_id, r.answer]));

  const mcqEvals: PerQuestionEval[] = [];
  const openForAi: Array<{ question: QuestionRow; answer: unknown }> = [];
  const unansweredOpen: PerQuestionEval[] = [];

  for (const q of questions) {
    const answer = answersByQ.get(q.id);
    if (q.type === 'MCQ') {
      mcqEvals.push(scoreMcq(q, answer));
      continue;
    }
    if (!isAnswered(answer)) {
      unansweredOpen.push(unansweredEval(q));
      continue;
    }
    openForAi.push({ question: q, answer });
  }

  let aiFailed = false;
  const aiByQuestion = new Map<string, AssessmentGradeResultItem>();

  if (openForAi.length > 0) {
    const result = await runAutomation<AssessmentGradeData>('assessment.grade', {
      questions: openForAi.map(({ question, answer }) => ({
        question_id: question.id,
        type: question.type,
        prompt: question.prompt,
        rubric: question.rubric,
        max_score: question.max_score,
        answer,
      })),
    });

    if (!result.ok || !result.data?.results) {
      aiFailed = true;
      console.error('[evaluateTechTest] assessment.grade failed', result);
    } else {
      for (const item of result.data.results) {
        aiByQuestion.set(item.question_id, item);
      }
    }
  }

  const openEvals: PerQuestionEval[] = openForAi.map(({ question }) => {
    if (aiFailed) {
      return {
        question_id: question.id,
        score: 0,
        max_score: Number(question.max_score) || 0,
        correct_concepts: [],
        missing_concepts: [],
        technical_errors: [],
        feedback: 'AI grading unavailable — please review manually',
        confidence: null,
        raw_response: null,
      };
    }
    return mapAiResult(question, aiByQuestion.get(question.id));
  });

  const allEvals = [...mcqEvals, ...unansweredOpen, ...openEvals];
  const sumScore = allEvals.reduce((s, e) => s + e.score, 0);
  const sumMax = allEvals.reduce((s, e) => s + e.max_score, 0);
  const totalPct = sumMax > 0 ? Math.round((sumScore / sumMax) * 1000) / 10 : 0;

  const proctorRows = await query<ProctorAgg>(
    `SELECT event, severity, count(*)::int AS n,
            min(occurred_at) AS first_at, max(occurred_at) AS last_at
     FROM proctoring_events
     WHERE candidate_assessment_id = $1
     GROUP BY event, severity`,
    [sittingId],
  );
  const proctor = proctoringFlag(proctorRows);

  const overallFeedback = aiFailed
    ? 'AI grading unavailable — please review manually'
    : `Scored ${sumScore} / ${sumMax} (${totalPct}%). ${proctor.summary}`;

  await tx(async (client) => {
    await client.query(`DELETE FROM assessment_evaluations WHERE candidate_assessment_id = $1`, [
      sittingId,
    ]);

    for (const ev of allEvals) {
      await client.query(
        `INSERT INTO assessment_evaluations (
           candidate_assessment_id, question_id, is_overall,
           score, max_score, correct_concepts, missing_concepts, technical_errors,
           feedback, confidence, model, raw_response
         ) VALUES (
           $1, $2, false,
           $3, $4, $5::jsonb, $6::jsonb, $7::jsonb,
           $8, $9, $10, $11::jsonb
         )`,
        [
          sittingId,
          ev.question_id,
          ev.score,
          ev.max_score,
          JSON.stringify(ev.correct_concepts),
          JSON.stringify(ev.missing_concepts),
          JSON.stringify(ev.technical_errors),
          ev.feedback,
          ev.confidence,
          aiFailed ? null : 'assessment.grade',
          ev.raw_response == null ? null : JSON.stringify(ev.raw_response),
        ],
      );
    }

    await client.query(
      `INSERT INTO assessment_evaluations (
         candidate_assessment_id, question_id, is_overall,
         score, max_score, correct_concepts, missing_concepts, technical_errors,
         feedback, confidence, model, raw_response
       ) VALUES (
         $1, NULL, true,
         $2, $3, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
         $4, $5, $6, $7::jsonb
       )`,
      [
        sittingId,
        sumScore,
        sumMax,
        overallFeedback,
        aiFailed ? null : 1,
        aiFailed ? null : 'assessment.grade',
        JSON.stringify({
          total_pct: totalPct,
          ai_failed: aiFailed,
          proctoring_flag: proctor.flag,
          proctoring_summary: proctor.summary,
          critical_timestamps: proctor.critical_timestamps,
        }),
      ],
    );

    await client.query(
      `UPDATE candidate_assessments
       SET ai_score = $2, ai_max_score = $3, updated_at = now()
       WHERE id = $1`,
      [sittingId, Math.round(totalPct), 100],
    );

    await client.query(
      `UPDATE applications
       SET techtest_score = $2,
           stage = 'RECORDED_TECH_REVIEW'::app_stage,
           updated_at = now()
       WHERE id = $1`,
      [sitting.application_id, Math.round(totalPct)],
    );

    await client.query(
      `INSERT INTO recruitment_events (
         application_id, candidate_id, job_id, event_type,
         from_stage, to_stage, actor_type, actor_label, payload
       ) VALUES (
         $1, $2, $3, 'TECHTEST_EVALUATED',
         $4::app_stage, 'RECORDED_TECH_REVIEW'::app_stage,
         'AI', 'assessment.grade', $5::jsonb
       )`,
      [
        sitting.application_id,
        sitting.candidate_id,
        sitting.job_id,
        sitting.stage,
        JSON.stringify({
          candidate_assessment_id: sittingId,
          ai_score: Math.round(totalPct),
          ai_failed: aiFailed,
          proctoring_flag: proctor.flag,
          // Descriptive only — never influences the score.
          proctoring_summary: proctor.summary,
        }),
      ],
    );
  });
}
