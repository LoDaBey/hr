-- Migration 014: leases for grading/screening claims (attempts count real outcomes only)
ALTER TABLE HRSYSTEM_candidate_assessments
  ADD COLUMN IF NOT EXISTS grading_claimed_at timestamptz;

ALTER TABLE HRSYSTEM_applications
  ADD COLUMN IF NOT EXISTS screening_claimed_at timestamptz;
