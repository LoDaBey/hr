-- Migration 010: allow per-job shortlist threshold to be cleared (use company default)
ALTER TABLE HRSYSTEM_jobs
  ALTER COLUMN shortlist_threshold DROP NOT NULL,
  ALTER COLUMN shortlist_threshold DROP DEFAULT;
