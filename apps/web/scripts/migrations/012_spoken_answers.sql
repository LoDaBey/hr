-- Migration 012: spoken answers + transcript/timings for recorded tech tests
ALTER TABLE HRSYSTEM_assessment_questions
  ADD COLUMN IF NOT EXISTS answer_mode text NOT NULL DEFAULT 'written'
  CHECK (answer_mode IN ('written', 'spoken'));

ALTER TABLE HRSYSTEM_candidate_assessments
  ADD COLUMN IF NOT EXISTS spoken_question_timings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript text;
