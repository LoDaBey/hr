-- Migration 005: automation decision settings on app_settings
ALTER TABLE HRSYSTEM_app_settings
  ADD COLUMN IF NOT EXISTS auto_reject_hard_fail       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_shortlist_enabled      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_shortlist_min_score    int     NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS auto_shortlist_min_confidence numeric(3,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS auto_reject_max_score       int     NOT NULL DEFAULT 40;
