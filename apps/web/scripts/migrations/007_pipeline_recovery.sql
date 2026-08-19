-- Migration 007: sweep attempt counters for stranded pipeline recovery
ALTER TABLE HRSYSTEM_candidate_assessments
  ADD COLUMN IF NOT EXISTS grading_attempts int NOT NULL DEFAULT 0;

ALTER TABLE HRSYSTEM_applications
  ADD COLUMN IF NOT EXISTS screening_attempts int NOT NULL DEFAULT 0;
