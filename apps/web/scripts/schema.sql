-- =====================================================================
-- HR Recruitment Automation — MVP schema (PostgreSQL 15+, Render)
-- Table names are prefixed HRSYSTEM_ so this schema can share a database
-- with the existing production tables (see scripts/production-DB).
--
-- Run once:  see scripts/README.md
-- Idempotent: safe to re-run.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()

-- ---------------------------------------------------------------- enums
DO $$ BEGIN
  CREATE TYPE HRSYSTEM_app_stage AS ENUM (
    'APPLICATION_RECEIVED','CV_PROCESSING','INITIAL_SCREENING','INITIAL_SCREENING_REVIEW',
    'INITIAL_SHORTLISTED','INITIAL_REJECTED',
    'TECH_ASSESSMENT_SENT','TECH_ASSESSMENT_STARTED','TECH_ASSESSMENT_SUBMITTED',
    'TECH_ASSESSMENT_EXPIRED','TECH_ASSESSMENT_REVIEW','TECH_SHORTLISTED','TECH_REJECTED',
    'RECORDED_TECH_INVITED','RECORDED_TECH_STARTED','RECORDED_TECH_SUBMITTED',
    'RECORDED_TECH_EXPIRED','RECORDED_TECH_REVIEW','RECORDED_TECH_SHORTLISTED',
    'RECORDED_TECH_REJECTED',
    'FINAL_INTERVIEW_PENDING','FINAL_INTERVIEW_SCHEDULED','FINAL_INTERVIEW_COMPLETED',
    'SECOND_FINAL_INTERVIEW','OFFER_PENDING','HIRED','FINAL_REJECTED','WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE HRSYSTEM_app_status AS ENUM ('ACTIVE','ON_HOLD','REJECTED','HIRED','WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE HRSYSTEM_ai_recommendation AS ENUM
    ('STRONG_SHORTLIST','SHORTLIST','MANUAL_REVIEW','RECOMMEND_REJECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE HRSYSTEM_assessment_kind AS ENUM ('ASSESSMENT','TECH_TEST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE HRSYSTEM_comm_status AS ENUM ('PENDING','SENT','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- HRSYSTEM_users
CREATE TABLE IF NOT EXISTS HRSYSTEM_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,                       -- bcrypt
  full_name     text NOT NULL,
  role          text NOT NULL DEFAULT 'HR'
                CHECK (role IN ('ADMIN','HR','REVIEWER')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- HRSYSTEM_jobs
CREATE TABLE IF NOT EXISTS HRSYSTEM_jobs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text UNIQUE NOT NULL,
  title                  text NOT NULL,
  department             text,
  description            text,
  employment_type        text,                        -- FULL_TIME / PART_TIME / CONTRACT / INTERN
  location               text,
  work_mode              text,                        -- REMOTE / HYBRID / ONSITE
  min_experience_years   numeric(4,1) DEFAULT 0,
  required_skills        text[] DEFAULT '{}',
  preferred_skills       text[] DEFAULT '{}',
  education_requirement  text,
  salary_min             numeric(12,2),
  salary_max             numeric(12,2),
  currency               text DEFAULT 'USD',
  languages              jsonb DEFAULT '{}'::jsonb,   -- {"English":"B2"}
  notice_period_max_days int,
  ask_age                boolean NOT NULL DEFAULT false,
  ask_military_status    boolean NOT NULL DEFAULT false,
  ask_marital_status     boolean NOT NULL DEFAULT false,
  -- screening config
  hard_requirements      jsonb NOT NULL DEFAULT '[]'::jsonb,
      -- [{"key":"nodejs_years","label":"Node.js experience","op":">=","value":3,
      --   "on_fail":"RECOMMEND_REJECT"},
      --  {"key":"military_status","label":"Military status","op":"in",
      --   "value":["Completed","Exempted","Not applicable"],"on_fail":"RECOMMEND_REJECT"}]
      -- Migration 006: op "==" with array value → "in" (see scripts/migrations/006_*.sql)
  soft_requirements      jsonb NOT NULL DEFAULT '[]'::jsonb,
      -- [{"key":"aws","label":"AWS","weight":10}]
  screening_weights      jsonb NOT NULL DEFAULT
      '{"skills":40,"experience":30,"answers":20,"education":10}'::jsonb,
  shortlist_threshold    int NOT NULL DEFAULT 70,
  -- pipeline config
  cv_required            boolean NOT NULL DEFAULT true,
  allow_reapply_days     int NOT NULL DEFAULT 180,
  assessment_invite_hours int NOT NULL DEFAULT 48,
  techtest_invite_hours   int NOT NULL DEFAULT 48,
  application_deadline   timestamptz,
  vacancies              int NOT NULL DEFAULT 1,
  hiring_manager         text,
  assigned_hr_id         uuid REFERENCES HRSYSTEM_users(id) ON DELETE SET NULL,
  status                 text NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','OPEN','PAUSED','CLOSED')),
  created_by             uuid REFERENCES HRSYSTEM_users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_jobs_status ON HRSYSTEM_jobs(status) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_jobs_assigned ON HRSYSTEM_jobs(assigned_hr_id);

-- -------------------------------------------------------- job questions
CREATE TABLE IF NOT EXISTS HRSYSTEM_job_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES HRSYSTEM_jobs(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  label       text NOT NULL,
  key         text NOT NULL,                          -- machine name used by screening
  type        text NOT NULL CHECK (type IN
              ('TEXT','TEXTAREA','NUMBER','SELECT','MULTISELECT','BOOLEAN','YEARS')),
  options     jsonb DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT true,
  UNIQUE (job_id, key)
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_job_questions_job ON HRSYSTEM_job_questions(job_id, order_index);

-- ---------------------------------------------- HRSYSTEM_assessments (both kinds)
CREATE TABLE IF NOT EXISTS HRSYSTEM_assessments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES HRSYSTEM_jobs(id) ON DELETE CASCADE,
  kind             HRSYSTEM_assessment_kind NOT NULL,
  title            text NOT NULL,
  instructions     text,
  duration_minutes int NOT NULL DEFAULT 60,
  pass_score       int NOT NULL DEFAULT 60,
  require_camera   boolean NOT NULL DEFAULT false,    -- TECH_TEST only
  require_mic      boolean NOT NULL DEFAULT false,
  require_fullscreen boolean NOT NULL DEFAULT false,
  require_screen_share boolean NOT NULL DEFAULT false,
  rules            text,                             -- shown to candidate before start (TECH_TEST)
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- uq_assessment_active: only one ACTIVE paper per job+kind (many inactive OK).
-- Replaces the old UNIQUE (job_id, kind, is_active) which blocked a second inactive row.
CREATE UNIQUE INDEX IF NOT EXISTS HRSYSTEM_assessments_one_active_per_job_kind
  ON HRSYSTEM_assessments (job_id, kind)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_assessments_job ON HRSYSTEM_assessments(job_id, kind);

CREATE TABLE IF NOT EXISTS HRSYSTEM_assessment_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES HRSYSTEM_assessments(id) ON DELETE CASCADE,
  order_index   int NOT NULL DEFAULT 0,
  type          text NOT NULL CHECK (type IN
                ('MCQ','TEXT','CODING','SQL','DEBUGGING','ARCHITECTURE','SCENARIO','FILE')),
  prompt        text NOT NULL,
  options       jsonb DEFAULT '[]'::jsonb,            -- MCQ: [{"key":"a","text":"..."}]
  correct_key   text,                                 -- MCQ auto-scoring; NEVER sent to candidate
  language      text,                                 -- CODING: js/py/sql...
  max_score     int NOT NULL DEFAULT 10,
  rubric        text                                  -- fed to the AI evaluator
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_aq_assessment ON HRSYSTEM_assessment_questions(assessment_id, order_index);

-- ----------------------------------------------------------- HRSYSTEM_candidates
CREATE TABLE IF NOT EXISTS HRSYSTEM_candidates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text UNIQUE NOT NULL,
  phone          text,
  full_name      text NOT NULL,
  country        text,
  city           text,
  age            int,
  military_status text,
  marital_status text,
  phone_history  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_candidates_phone ON HRSYSTEM_candidates(phone);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_candidates_name  ON HRSYSTEM_candidates USING gin (to_tsvector('simple', full_name));

-- --------------------------------------------------------- HRSYSTEM_applications
CREATE TABLE IF NOT EXISTS HRSYSTEM_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        uuid NOT NULL REFERENCES HRSYSTEM_candidates(id) ON DELETE CASCADE,
  job_id              uuid NOT NULL REFERENCES HRSYSTEM_jobs(id) ON DELETE CASCADE,
  stage               HRSYSTEM_app_stage  NOT NULL DEFAULT 'APPLICATION_RECEIVED',
  status              HRSYSTEM_app_status NOT NULL DEFAULT 'ACTIVE',
  -- professional snapshot (candidate-supplied; never overwritten by AI)
  employment_status   text,
  current_company     text,
  current_position    text,
  years_experience    numeric(4,1),
  expected_salary     numeric(12,2),
  notice_period_days  int,
  available_from      date,
  -- derived
  screening_score     int,
  assessment_score    int,
  techtest_score      int,
  final_score         int,
  hold_reason         text,
  reject_reason       text,
  source              text DEFAULT 'PORTAL',
  submission_id       text UNIQUE,                    -- client idempotency id
  screening_attempts  int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS HRSYSTEM_uq_app_candidate_job_active
  ON HRSYSTEM_applications(candidate_id, job_id)
  WHERE status NOT IN ('REJECTED','WITHDRAWN');
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_app_job_stage ON HRSYSTEM_applications(job_id, stage);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_app_stage     ON HRSYSTEM_applications(stage) WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_app_created   ON HRSYSTEM_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_app_score     ON HRSYSTEM_applications(screening_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS HRSYSTEM_application_answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  question_id    uuid REFERENCES HRSYSTEM_job_questions(id) ON DELETE SET NULL,
  question_key   text NOT NULL,
  answer         jsonb NOT NULL,
  UNIQUE (application_id, question_key)
);

-- ------------------------------------------------------------ HRSYSTEM_documents
CREATE TABLE IF NOT EXISTS HRSYSTEM_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   uuid NOT NULL REFERENCES HRSYSTEM_candidates(id) ON DELETE CASCADE,
  application_id uuid REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  doc_type       text NOT NULL DEFAULT 'CV',          -- CV / PORTFOLIO / ATTACHMENT
  public_id      text NOT NULL,                       -- Cloudinary
  resource_type  text NOT NULL DEFAULT 'raw',
  delivery_type  text NOT NULL DEFAULT 'authenticated',
  format         text,
  bytes          int,
  original_name  text,
  raw_text       text,                                -- extracted CV text
  parsed         jsonb,                               -- AI structured parse
  parse_status   text NOT NULL DEFAULT 'PENDING'
                 CHECK (parse_status IN ('PENDING','DONE','MANUAL','FAILED')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_docs_app ON HRSYSTEM_documents(application_id);

-- ---------------------------------------------------- screening results
CREATE TABLE IF NOT EXISTS HRSYSTEM_screening_results (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       uuid NOT NULL REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  score                int,
  recommendation       HRSYSTEM_ai_recommendation,
  confidence           numeric(3,2),
  strengths            jsonb DEFAULT '[]'::jsonb,
  weaknesses           jsonb DEFAULT '[]'::jsonb,
  missing_requirements jsonb DEFAULT '[]'::jsonb,
  hard_fail            boolean NOT NULL DEFAULT false,
  reasoning_summary    text,
  model                text,
  raw_response         jsonb,
  -- HR side, stored next to AI, never on top of it
  hr_decision          text,
  hr_override_reason   text,
  hr_user_id           uuid REFERENCES HRSYSTEM_users(id) ON DELETE SET NULL,
  hr_decided_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_screening_app ON HRSYSTEM_screening_results(application_id);

-- -------------------------------------------------- candidate sittings
CREATE TABLE IF NOT EXISTS HRSYSTEM_candidate_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    uuid NOT NULL REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  assessment_id     uuid NOT NULL REFERENCES HRSYSTEM_assessments(id) ON DELETE RESTRICT,
  kind              HRSYSTEM_assessment_kind NOT NULL,
  status            text NOT NULL DEFAULT 'INVITED'
                    CHECK (status IN ('INVITED','STARTED','SUBMITTED','EXPIRED','CANCELLED')),
  invite_deadline   timestamptz NOT NULL,
  duration_minutes  int NOT NULL,
  started_at        timestamptz,
  expires_at        timestamptz,                      -- started_at + duration
  submitted_at      timestamptz,
  late              boolean NOT NULL DEFAULT false,
  attempts_allowed  int NOT NULL DEFAULT 1,
  attempt_no        int NOT NULL DEFAULT 1,
  ai_score          int,
  ai_max_score      int,
  hr_decision       text,
  hr_user_id        uuid REFERENCES HRSYSTEM_users(id) ON DELETE SET NULL,
  hr_decided_at     timestamptz,
  -- TECH_TEST only
  recording_status  text CHECK (recording_status IN ('NOT_REQUIRED','UPLOAD_PENDING','READY','FAILED')),
  violations_count  int NOT NULL DEFAULT 0,
  reminder_sent_at  timestamptz,
  grading_attempts  int NOT NULL DEFAULT 0,
  preflight_external_display boolean,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_ca_app     ON HRSYSTEM_candidate_assessments(application_id, kind);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_ca_status  ON HRSYSTEM_candidate_assessments(status, invite_deadline);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_ca_expires ON HRSYSTEM_candidate_assessments(status, expires_at);

CREATE TABLE IF NOT EXISTS HRSYSTEM_assessment_answers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_assessment_id uuid NOT NULL REFERENCES HRSYSTEM_candidate_assessments(id) ON DELETE CASCADE,
  question_id            uuid NOT NULL REFERENCES HRSYSTEM_assessment_questions(id) ON DELETE CASCADE,
  answer                 jsonb NOT NULL,
  time_spent_seconds     int,
  answered_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_assessment_id, question_id)
);

CREATE TABLE IF NOT EXISTS HRSYSTEM_assessment_evaluations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_assessment_id uuid NOT NULL REFERENCES HRSYSTEM_candidate_assessments(id) ON DELETE CASCADE,
  question_id             uuid REFERENCES HRSYSTEM_assessment_questions(id) ON DELETE CASCADE,
  is_overall              boolean NOT NULL DEFAULT false,
  score                   numeric(6,2),
  max_score               numeric(6,2),
  correct_concepts        jsonb DEFAULT '[]'::jsonb,
  missing_concepts        jsonb DEFAULT '[]'::jsonb,
  technical_errors        jsonb DEFAULT '[]'::jsonb,
  feedback                text,
  confidence              numeric(3,2),
  model                   text,
  raw_response            jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_eval_ca ON HRSYSTEM_assessment_evaluations(candidate_assessment_id);

-- ---------------------------------------------- proctoring + HRSYSTEM_recordings
CREATE TABLE IF NOT EXISTS HRSYSTEM_proctoring_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_assessment_id uuid NOT NULL REFERENCES HRSYSTEM_candidate_assessments(id) ON DELETE CASCADE,
  event                   text NOT NULL,   -- TAB_CHANGED, FULLSCREEN_EXIT, CAMERA_OFF, MIC_OFF,
                                           -- WINDOW_BLUR, CONNECTION_LOST, PASTE_DETECTED,
                                           -- EXTERNAL_DISPLAY, SCREEN_SHARE_STOPPED
  severity                text NOT NULL DEFAULT 'INFO'
                          CHECK (severity IN ('INFO','WARN','CRITICAL')),
  occurred_at             timestamptz NOT NULL,
  metadata                jsonb DEFAULT '{}'::jsonb,
  event_id                text,                       -- client idempotency
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_assessment_id, event_id)
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_proctor_ca ON HRSYSTEM_proctoring_events(candidate_assessment_id, occurred_at);

CREATE TABLE IF NOT EXISTS HRSYSTEM_recordings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_assessment_id uuid NOT NULL REFERENCES HRSYSTEM_candidate_assessments(id) ON DELETE CASCADE,
  part_no                 int NOT NULL DEFAULT 1,
  public_id               text NOT NULL,
  resource_type           text NOT NULL DEFAULT 'video',
  delivery_type           text NOT NULL DEFAULT 'authenticated',
  format                  text,
  duration_seconds        int,
  bytes                   bigint,
  started_at              timestamptz,
  ended_at                timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_assessment_id, part_no)
);

-- ----------------------------------------------------------- HRSYSTEM_interviews
CREATE TABLE IF NOT EXISTS HRSYSTEM_interviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    uuid NOT NULL REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  round_no          int NOT NULL DEFAULT 1,
  scheduled_at      timestamptz NOT NULL,
  timezone          text NOT NULL DEFAULT 'UTC',
  duration_minutes  int NOT NULL DEFAULT 45,
  interviewer_name  text,
  interviewer_email text,
  meeting_url       text,
  status            text NOT NULL DEFAULT 'SCHEDULED'
                    CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at  timestamptz,
  score             int,
  notes             text,
  salary_discussed  numeric(12,2),
  availability_note text,
  recommendation    text,
  created_by        uuid REFERENCES HRSYSTEM_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, round_no)
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_interviews_upcoming
  ON HRSYSTEM_interviews(scheduled_at) WHERE status = 'SCHEDULED';

-- ------------------------------------------------- email outbox + templates
CREATE TABLE IF NOT EXISTS HRSYSTEM_email_templates (
  key        text PRIMARY KEY,
  subject    text NOT NULL,
  body_html  text NOT NULL,
  language   text NOT NULL DEFAULT 'en',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS HRSYSTEM_communications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     uuid REFERENCES HRSYSTEM_candidates(id) ON DELETE SET NULL,
  application_id   uuid REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  template_key     text NOT NULL REFERENCES HRSYSTEM_email_templates(key),
  to_email         text NOT NULL,
  subject          text,
  variables        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           HRSYSTEM_comm_status NOT NULL DEFAULT 'PENDING',
  attempts         int NOT NULL DEFAULT 0,
  last_error       text,
  gmail_message_id text,
  dedupe_key       text UNIQUE NOT NULL,
  scheduled_for    timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_comm_pending
  ON HRSYSTEM_communications(status, scheduled_for) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_comm_app ON HRSYSTEM_communications(application_id, created_at DESC);

-- ------------------------------------------------ audit + errors + tokens
CREATE TABLE IF NOT EXISTS HRSYSTEM_recruitment_events (
  id             bigserial PRIMARY KEY,
  application_id uuid REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  candidate_id   uuid REFERENCES HRSYSTEM_candidates(id) ON DELETE CASCADE,
  job_id         uuid REFERENCES HRSYSTEM_jobs(id) ON DELETE CASCADE,
  event_type     text NOT NULL,
  from_stage     HRSYSTEM_app_stage,
  to_stage       HRSYSTEM_app_stage,
  actor_type     text NOT NULL DEFAULT 'SYSTEM'
                 CHECK (actor_type IN ('SYSTEM','HR','CANDIDATE','AI','CRON')),
  actor_id       uuid,
  actor_label    text,
  payload        jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_events_app ON HRSYSTEM_recruitment_events(application_id, created_at);
-- append-only guard: history cannot be REWRITTEN. Deleting a whole record (a job, a
-- candidate, a right-to-erasure request) cascades and must stay possible, so this
-- blocks UPDATE only. Blocking DELETE too would make HRSYSTEM_jobs and HRSYSTEM_candidates undeletable.
CREATE OR REPLACE FUNCTION HRSYSTEM_deny_event_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'HRSYSTEM_recruitment_events is append-only: rows cannot be edited';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_events_immutable ON HRSYSTEM_recruitment_events;
DROP TRIGGER IF EXISTS HRSYSTEM_trg_events_no_update ON HRSYSTEM_recruitment_events;
CREATE TRIGGER HRSYSTEM_trg_events_no_update BEFORE UPDATE ON HRSYSTEM_recruitment_events
  FOR EACH ROW EXECUTE FUNCTION HRSYSTEM_deny_event_update();

CREATE TABLE IF NOT EXISTS HRSYSTEM_workflow_errors (
  id             bigserial PRIMARY KEY,
  action         text,
  node           text,
  error_message  text,
  error_stack    text,
  application_id uuid REFERENCES HRSYSTEM_applications(id) ON DELETE SET NULL,
  candidate_id   uuid REFERENCES HRSYSTEM_candidates(id) ON DELETE SET NULL,
  input_ref      jsonb,
  retry_count    int NOT NULL DEFAULT 0,
  resolved       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_errors_open ON HRSYSTEM_workflow_errors(created_at DESC) WHERE resolved = false;

CREATE TABLE IF NOT EXISTS HRSYSTEM_access_tokens (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash              text UNIQUE NOT NULL,       -- sha256(token + pepper)
  purpose                 text NOT NULL CHECK (purpose IN ('ASSESSMENT','TECH_TEST')),
  application_id          uuid NOT NULL REFERENCES HRSYSTEM_applications(id) ON DELETE CASCADE,
  candidate_assessment_id uuid NOT NULL REFERENCES HRSYSTEM_candidate_assessments(id) ON DELETE CASCADE,
  expires_at              timestamptz NOT NULL,
  used_at                 timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_tokens_ca ON HRSYSTEM_access_tokens(candidate_assessment_id);

CREATE TABLE IF NOT EXISTS HRSYSTEM_idempotency_keys (
  key        text PRIMARY KEY,
  action     text NOT NULL,
  response   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS HRSYSTEM_idx_idem_created ON HRSYSTEM_idempotency_keys(created_at);

CREATE TABLE IF NOT EXISTS HRSYSTEM_rate_limits (
  bucket     text NOT NULL,          -- e.g. 'apply:1.2.3.4'
  window_start timestamptz NOT NULL,
  hits       int NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, window_start)
);

-- Single-row global settings (exactly one row; id CHECK prevents a second)
CREATE TABLE IF NOT EXISTS HRSYSTEM_app_settings (
  id                                 boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_send_assessment               boolean NOT NULL DEFAULT true,
  auto_send_assessment_delay_minutes int     NOT NULL DEFAULT 60,
  auto_send_techtest                 boolean NOT NULL DEFAULT true,
  auto_send_techtest_delay_minutes   int     NOT NULL DEFAULT 60,
  auto_reject_hard_fail              boolean NOT NULL DEFAULT true,
  auto_shortlist_enabled             boolean NOT NULL DEFAULT true,
  auto_shortlist_min_score           int     NOT NULL DEFAULT 75,
  auto_shortlist_min_confidence      numeric(3,2) NOT NULL DEFAULT 0.75,
  auto_reject_max_score              int     NOT NULL DEFAULT 40,
  updated_at                         timestamptz NOT NULL DEFAULT now(),
  updated_by                         uuid REFERENCES HRSYSTEM_users(id) ON DELETE SET NULL
);
INSERT INTO HRSYSTEM_app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- --------------------------------------------------- updated_at triggers
CREATE OR REPLACE FUNCTION HRSYSTEM_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['HRSYSTEM_users','HRSYSTEM_jobs','HRSYSTEM_candidates','HRSYSTEM_applications',
                           'HRSYSTEM_candidate_assessments','HRSYSTEM_interviews','HRSYSTEM_app_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS HRSYSTEM_trg_touch_%1$s ON %1$s', t);
    EXECUTE format('CREATE TRIGGER HRSYSTEM_trg_touch_%1$s BEFORE UPDATE ON %1$s
                    FOR EACH ROW EXECUTE FUNCTION HRSYSTEM_touch_updated_at()', t);
  END LOOP;
END $$;


INSERT INTO HRSYSTEM_email_templates (key, subject, body_html) VALUES
('APPLICATION_RECEIVED','We received your application for {{job_title}}',
 '<p>Hi {{candidate_name}},</p><p>Thanks for applying to <b>{{job_title}}</b>. Our team is reviewing your application and we will get back to you.</p><p>{{hr_name}}</p>'),
('INITIAL_SHORTLIST','Next step for your {{job_title}} application',
 '<p>Hi {{candidate_name}},</p><p>Good news — you are moving to the next stage for <b>{{job_title}}</b>.</p><p>{{hr_name}}</p>'),
('REJECTION','Update on your {{job_title}} application',
 '<p>Hi {{candidate_name}},</p><p>Thank you for your interest in <b>{{job_title}}</b>. We will not be moving forward at this time.</p><p>{{hr_name}}</p>'),
('ASSESSMENT_INVITE','Technical assessment for {{job_title}}',
 '<p>Hi {{candidate_name}},</p><p>Please complete your technical assessment: <a href="{{assessment_link}}">Start assessment</a></p><p>Start before <b>{{assessment_deadline}}</b>. Once you start you have {{duration_minutes}} minutes.</p><p>{{hr_name}}</p>'),
('ASSESSMENT_REMINDER','Reminder: your {{job_title}} assessment',
 '<p>Hi {{candidate_name}},</p><p>Your assessment link expires on {{assessment_deadline}}: <a href="{{assessment_link}}">Start now</a></p>'),
('ASSESSMENT_EXPIRED','Your {{job_title}} assessment has expired',
 '<p>Hi {{candidate_name}},</p><p>The assessment window has closed. Contact us if you had a technical problem.</p>'),
('TECHTEST_INVITE','Recorded technical interview for {{job_title}}',
 '<p>Hi {{candidate_name}},</p><p>Next step for <b>{{job_title}}</b> is a recorded technical interview: <a href="{{interview_link}}">Start interview</a></p><p>You need a working camera and microphone. The session is recorded. Start before <b>{{assessment_deadline}}</b>. Once you start you have {{duration_minutes}} minutes.</p><p>{{hr_name}}</p>'),
('INTERVIEW_INVITE','Final interview — {{job_title}}',
 '<p>Hi {{candidate_name}},</p><p>Your final interview is scheduled for <b>{{interview_date}} at {{interview_time}} ({{timezone}})</b>.</p><p>Join here: <a href="{{meeting_url}}">{{meeting_url}}</a></p><p>{{hr_name}}</p>'),
('INTERVIEWER_INVITE','Interview scheduled — {{candidate_name}} for {{job_title}}',
 '<p>Hi,</p><p>You are scheduled to interview <b>{{candidate_name}}</b> for the <b>{{job_title}}</b> role.</p><p><b>When:</b> {{interview_date}} at {{interview_time}} ({{timezone}})<br/><b>Duration:</b> {{duration_minutes}} minutes</p><p><b>Join:</b> <a href="{{meeting_url}}">{{meeting_url}}</a></p><p>Review the candidate before the call: <a href="{{candidate_profile_url}}">Open candidate profile</a></p><p>{{hr_name}}</p>'),
('INTERVIEW_REMINDER','Reminder: interview {{interview_date}} {{interview_time}}',
 '<p>Hi {{candidate_name}},</p><p>Reminder for your interview on {{interview_date}} at {{interview_time}} ({{timezone}}).</p><p><a href="{{meeting_url}}">Join link</a></p>'),
('OFFER','Offer — {{job_title}}',
 '<p>Hi {{candidate_name}},</p><p>We would like to offer you the <b>{{job_title}}</b> role. We will follow up with the details.</p><p>{{hr_name}}</p>'),
('HIRED','Welcome aboard — {{job_title}}',
 '<p>Hi {{candidate_name}},</p><p>Welcome to the team! We are delighted to confirm your hire as <b>{{job_title}}</b>.</p><p>{{hr_name}}</p>')
ON CONFLICT (key) DO NOTHING;