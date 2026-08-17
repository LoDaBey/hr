import { one, query } from '@/lib/db';
import { resolveToken, rulesToList } from '@/lib/assessment-token';
import { jsonError, jsonOk } from '@/lib/http';
import type { CandidateAssessmentGetResult, CandidateQuestion } from '@/types/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return jsonError(401, 'TOKEN_INVALID', 'This link is not valid.');
  }

  try {
    const resolved = await resolveToken(token, 'TECH_TEST');
    if (!resolved.ok) {
      const status =
        resolved.error.code === 'ALREADY_SUBMITTED'
          ? 409
          : resolved.error.code === 'TOKEN_EXPIRED'
            ? 410
            : 401;
      return jsonError(status, resolved.error.code, resolved.error.message);
    }

    const sitting = resolved.data;

    const questions = await query<CandidateQuestion>(
      `SELECT id, order_index, type, prompt, options, language, max_score
       FROM assessment_questions
       WHERE assessment_id = $1
       ORDER BY order_index ASC, id ASC`,
      [sitting.assessment_id],
    );

    const answers = await query<{ question_id: string; answer: unknown }>(
      `SELECT question_id, answer
       FROM assessment_answers
       WHERE candidate_assessment_id = $1`,
      [sitting.sitting_id],
    );

    const serverTime = await one<{ now: string }>(`SELECT now() AS now`);

    const data: CandidateAssessmentGetResult = {
      candidate_name: sitting.candidate_name,
      job_title: sitting.job_title,
      assessment: {
        title: sitting.title,
        instructions: sitting.instructions,
        duration_minutes: sitting.duration_minutes,
        question_count: questions.length,
      },
      status: sitting.status,
      invite_deadline: sitting.invite_deadline,
      started_at: sitting.started_at,
      expires_at: sitting.expires_at_sitting,
      server_time: serverTime?.now ?? new Date().toISOString(),
      questions,
      answers,
      requirements: {
        camera: sitting.require_camera,
        mic: sitting.require_mic,
        fullscreen: sitting.require_fullscreen,
        rules: rulesToList(sitting.rules),
      },
    };

    return jsonOk(data);
  } catch (error) {
    console.error(error);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to load tech interview');
  }
}
