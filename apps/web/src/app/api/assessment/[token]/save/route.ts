import { z } from 'zod';
import { resolveToken } from '@/lib/assessment-token';
import { pool } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/http';
import type { CandidateAssessmentSaveResult } from '@/types/api';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  answers: z.array(
    z.object({
      question_id: z.string().uuid(),
      answer: z.unknown(),
      time_spent_seconds: z.number().int().nonnegative().optional(),
    }),
  ),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return jsonError(401, 'TOKEN_INVALID', 'This link is not valid.');
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }

  const parsed = bodySchema.safeParse(raw);
  const answers = parsed.success ? parsed.data.answers : [];

  try {
    const resolved = await resolveToken(token, 'ASSESSMENT');
    if (!resolved.ok) {
      // Still 200 for autosave — never interrupt the candidate.
      const data: CandidateAssessmentSaveResult = { saved: 0 };
      return jsonOk(data);
    }

    if (resolved.data.status !== 'STARTED' && resolved.data.status !== 'INVITED') {
      return jsonOk({ saved: 0 } satisfies CandidateAssessmentSaveResult);
    }

    let saved = 0;
    for (const row of answers) {
      try {
        await pool.query(
          `INSERT INTO HRSYSTEM_assessment_answers (
             candidate_assessment_id, question_id, answer, time_spent_seconds, answered_at
           )
           VALUES ($1, $2, $3::jsonb, $4, now())
           ON CONFLICT (candidate_assessment_id, question_id) DO UPDATE SET
             answer = EXCLUDED.answer,
             time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, HRSYSTEM_assessment_answers.time_spent_seconds),
             answered_at = now()`,
          [
            resolved.data.sitting_id,
            row.question_id,
            JSON.stringify(row.answer ?? null),
            row.time_spent_seconds ?? null,
          ],
        );
        saved += 1;
      } catch (error) {
        console.error('assessment save row failed', error);
      }
    }

    return jsonOk({ saved } satisfies CandidateAssessmentSaveResult);
  } catch (error) {
    console.error(error);
    return jsonOk({ saved: 0 } satisfies CandidateAssessmentSaveResult);
  }
}
