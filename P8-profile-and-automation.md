# P8 — Candidate profile rebuild and honest automation

One ticket. Read `ARCHITECTURE.md` first.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**
**Any schema change gets a numbered migration AND goes into `schema.sql`, same commit.**

The candidate profile is the page HR lives in. Right now it leaks developer artefacts —
raw JSON, truncated chips, machine keys, `null – null` — and the automation stops short of
deciding anything. Both are fixed here.

---

## T-32 · Rebuild the candidate profile

**File:** `src/app/hr/candidates/[applicationId]/components/CandidateDetailView.tsx`
and its API in `src/app/api/hr/candidates/[applicationId]/route.ts`.

### 32.1 — Delete the raw JSON entirely

Remove the **View raw / Hide raw** toggle and the `<pre>` JSON block. Not collapsed —
**deleted**. No HR user has any use for it, and its presence is the clearest signal that
this page was never designed for them.

### 32.2 — Show every skill. No cropping.

`+44 MORE` is unacceptable. HR needs the whole picture to judge a candidate.

- Render **all** skills and technologies as chips, wrapped across as many lines as needed.
- Split into two labelled groups — **Skills** and **Technologies** — not one merged blob.
- Sort alphabetically within each group so scanning is predictable.
- No `+N more`, no truncation, no "show more" anywhere on this page.

### 32.3 — Work history must be readable

Currently every row reads `null – null`. The n8n prompt has been fixed to extract real
dates, so re-run a parse to confirm. In the UI:

- One row per role: **Company** · Title on the first line, dates on the second, the summary
  sentence beneath.
- Format dates as `Mar 2021 – Present`. **If a date is genuinely missing, print nothing** —
  never `null`, never a dash with empty sides.
- Newest first.
- Same rule everywhere on this page: a null or undefined value renders as nothing, or as
  `—` when a column must hold a place. `null` must not appear as text anywhere in the app.

### 32.4 — Application answers must be complete

Show **everything the candidate submitted**, grouped and labelled:

- **Personal** — full name, email, phone, country, city, and age / military status /
  marital status when the job asked for them.
- **Professional** — employment status, current company, current position, years of
  experience, expected salary with the job's currency, notice period, available from.
- **Questions** — every `job_questions` row for this job, in `order_index` order, showing
  the **question label**. Unanswered questions still appear, marked "Not answered", so HR
  can see what was skipped.

The API must join `HRSYSTEM_job_questions` on `(job_id, key)` and return the label.
`do_you_know_how_to_write_sql_to_store_da` must never reach the screen. Booleans render as
Yes / No, not `true`.

### 32.5 — The CV block

- Drop **"Link expires in 600s"**. It is an implementation detail and it makes HR think the
  CV will vanish. If a signed URL expires, silently mint a new one when they click.
- Keep the filename and a single **Open CV** action.
- The parse status pill only appears when the status is **not** `DONE` — and then it says
  something useful: "Could not read this CV — open the file", not `FAILED`.

### 32.6 — The recommendation block

Rename the heading from **"AI recommendation — not a decision"** to **"Screening result"**.

- Score as a large number out of 100 with the recommendation beside it in plain words —
  *Strong match*, *Good match*, *Needs review*, *Weak match*.
- **Strengths**, **Weaknesses** and **Missing** as three labelled bulleted lists. Never
  `["a","b"]` printed as a raw array, never comma-squashed prose.
- The reasoning paragraph sits below them, in normal body text with real line height.
- If HR has overridden the recommendation, show their decision beside it — never on top.

### 32.7 — Remove "Re-run screening"

It was not asked for and it produced four duplicate `AI_SCREENING_COMPLETED` events in one
timeline. Delete the button and its route. Screening runs once, on submission.

### 32.8 — Timeline

Render human sentences, not enum names. `ASSESSMENT_INVITED` → "Assessment invitation
sent". `HR_DECISION` → "HR shortlisted this candidate". Group by day. Keep the actor.

---

## T-33 · Make the emails legible and truthful

The Emails block currently shows a template key and a status with no explanation.

- Show a human name for each email — `ASSESSMENT_INVITE` → "Technical assessment
  invitation", `APPLICATION_RECEIVED` → "Application received".
- Show **Sent** with the delivery time, or **Queued — sending within 5 minutes**, or
  **Failed** with a Retry button. Never a bare "Pending" with no explanation of what
  happens next.
- Order newest first.
- Add a **Send now** action beside any queued email, so HR never waits on the cron.

---

## T-34 · Let the automation actually decide

This is the core complaint: the system produces a recommendation and then asks a human to
act on it anyway. Fix it with the settings from P7 plus these.

**Migration 005** — extend `HRSYSTEM_app_settings`:

```sql
ALTER TABLE HRSYSTEM_app_settings
  ADD COLUMN IF NOT EXISTS auto_reject_hard_fail       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_shortlist_enabled      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_shortlist_min_score    int     NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS auto_shortlist_min_confidence numeric(3,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS auto_reject_max_score       int     NOT NULL DEFAULT 40;
```

In the screening pipeline, once the result is stored:

1. **Hard requirement failed with `on_fail = RECOMMEND_REJECT`** → auto-reject, queue the
   rejection email, stage `INITIAL_REJECTED`. This is deterministic code, never an AI score.
2. **score ≥ `auto_shortlist_min_score` AND confidence ≥ min AND `missing_requirements`
   empty** → auto-shortlist and issue the assessment invite through the existing
   `issueInvite()`.
3. **score ≤ `auto_reject_max_score`** → auto-reject with the rejection email.
4. **Anything else** → `INITIAL_SCREENING_REVIEW` for a human.

Same shape after grading: `ai_score ≥ assessment.pass_score` and high confidence →
auto-advance to `TECH_SHORTLISTED` and issue the recorded-test invite.

**`RECORDED_TECH_REVIEW` and the final hiring decision stay human. Always. No setting
overrides that.** Everything before them can run unattended.

Every automatic transition writes a `HRSYSTEM_recruitment_events` row with
`actor_type = 'SYSTEM'` and the reason, so the timeline explains why someone moved without
a click.

**Also use `shortlist_threshold`.** Today it is stored, shown in the wizard, sent to the AI
and compared to nothing. Either wire it in as the per-job override of
`auto_shortlist_min_score`, or delete it from the editor. A control that does nothing is
worse than no control.

**Dashboard:** add a **Needs your review** tile counting candidates sitting at a review
stage, and make it the first tile. That number is the only queue HR should work from.

---

## Verify

Apply as a strong candidate and as a weak one. The strong one should reach
`TECH_ASSESSMENT_SENT` with an invitation email **without anyone clicking**. The weak one
should be rejected with an email, also without a click. Only a middling candidate should
appear in "Needs your review".

Then open a profile: no JSON, no `+N more`, no `null`, no machine keys, every skill visible,
work history with real dates, every submitted answer present, and a screening result a
non-technical person can act on in ten seconds.
