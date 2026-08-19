-- P15 T-54: screen-share requirement and preflight external-display flag
ALTER TABLE HRSYSTEM_assessments
  ADD COLUMN IF NOT EXISTS require_screen_share boolean NOT NULL DEFAULT false;

ALTER TABLE HRSYSTEM_candidate_assessments
  ADD COLUMN IF NOT EXISTS preflight_external_display boolean;
