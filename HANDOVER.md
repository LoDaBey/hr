# HR Recruitment Automation — Handover

Written 20 Aug 2026. Every fact here was verified against the codebase and the live n8n
workflow, not from memory.

---

## 1. What this is

A recruitment system that takes a candidate from public application to hire, running the
pipeline unattended and involving HR only where judgement genuinely changes the outcome.

**Live:** `https://hr-flax-beta.vercel.app` · n8n at `https://n8n.khghonim.cloud` ·
PostgreSQL on Render.

---

## 2. Architecture and why it is this shape

```
Browser
  │
  ▼
Next.js 15 + TypeScript  (Vercel)  ←──→  PostgreSQL (Render, direct `pg`)
  owns: all SQL, all state, all business rules, auth, scheduling decisions
  │
  │  POST /webhook/hr-automation   { task, payload }
  ▼
n8n "HR Automations"  (VPS)
  owns: four stateless AI/email tasks. No database. No auth. No state.
```

**The original spec put n8n in charge of everything** — 19 workflows acting as the API,
the database layer and the business logic. That was abandoned on 16 Aug after building it
(`WF-HR-CORE`, 189 nodes) and finding it unmaintainable: no types, no transactions, no way
to test, and business rules scattered across dozens of Code nodes.

**The rule now:** if it touches the database or decides anything, it is TypeScript. If it
calls a model or sends mail, it is n8n. That boundary has held and is worth defending.

**Stack:** Next.js 15 App Router · Mantine 9 (no Tailwind) · SWR (no TanStack Query) ·
NextAuth v5 Credentials verifying against Postgres `crypt()` · Cloudinary for CVs and
recordings · `framer-motion` · `recordrtc`.

---

## 3. n8n — exactly how it works

**Workflow `HR Automations`, id `Gu2wYqDFJlmrujrD`, 31 nodes, active.**

### Entry
`POST https://n8n.khghonim.cloud/webhook/hr-automation`
Header `x-automation-secret` (Header Auth credential — n8n Variables are a paid feature on
this instance, so credentials carry secrets).

```
Webhook → FN Guard (validates `task`) → SW Task (switch, 5 outputs + fallback)
```

### The four tasks

| Task | Path | Returns |
|---|---|---|
| `cv.parse` | HTTP Download CV → Extract PDF → FN Prep CV → **AI Parse CV** → FN Shape CV | structured CV + raw text |
| `screening.run` | FN Prep Screen → **AI Screen Candidate** → FN Shape Screen | score 0–100, decision, confidence, strengths, weaknesses, missing, evidence |
| `assessment.grade` | FN Prep Grade → **AI Grade Answers** → FN Shape Grade | per-question score, concepts covered/missed, errors, feedback, confidence |
| `email.send` | **Gmail Send** → FN Shape Email | message id |

All three AI nodes are `chainLlm` on **`gpt-4.1-mini`, temperature 0**, each with a
Structured Output Parser. Deterministic — the same input scores the same twice.

Every branch ends at `Respond OK` (`{ok:true,data}`) or `Respond Error`
(`{ok:false,error}`). Download, PDF extract and Gmail all have error outputs wired, so a
failure returns a shaped error rather than hanging.

**Gmail Send** retries 3× with 2s between attempts before reporting failure.

### The schedule
`Schedule: every 5 min` fans out to four Next.js routes, each with Bearer `CRON_SECRET`:

| Node | Route | Purpose |
|---|---|---|
| CRON · Email Dispatch | `/api/cron/email-dispatch` | drain the outbox |
| CRON · Deadline Monitor | `/api/cron/deadline-monitor` | expire sittings, send reminders |
| CRON · Interview Reminders | `/api/cron/interview-reminders` | 24h and 2h |
| CRON · Pipeline Sweep | `/api/cron/pipeline-sweep` | recover stranded work |

There is **no Vercel Cron**. n8n owns the clock; Next.js owns what happens.

### Two rules learned the hard way
1. **Publish after every change.** n8n serves the *published* version; a saved draft is not
   live. Several hours were lost to this.
2. **Never enable "Ignore Bots" on a server-to-server webhook.** It rejects with
   `403 Authorization data is wrong!` *before* the auth check, so it looks exactly like a
   bad secret. Node's `fetch` user agent is flagged as a bot; PowerShell's is not — which is
   why it worked from a laptop and never from Vercel. This cost the single longest debugging
   session of the project.

---

## 4. Database

**24 tables, all prefixed `HRSYSTEM_`** so the schema can be applied to a shared production
database without colliding. Postgres folds unquoted identifiers to lowercase, so they exist
as `hrsystem_*`.

`apps/web/scripts/schema.sql` is canonical and complete — every migration is folded in.
A fresh database needs only that file. Migrations 005–009 are the incremental record.

**No seeded user.** Create the first HR account with an `INSERT … crypt(…)`; see
`scripts/README.md`.

Notable design: `recruitment_events` is append-only for UPDATE (history cannot be rewritten)
but DELETE cascades, so a job or a right-to-erasure request still works.

---

## 5. The pipeline, stage by stage

| Stage | Who acts | What happens |
|---|---|---|
| Job created | HR | five-step wizard, publish, share link |
| Application | Candidate | public form, CV direct to Cloudinary |
| CV parse | **automatic** | download, extract, structure |
| Hard requirements | **automatic** | evaluated in TypeScript, not AI |
| Screening | **automatic** | 0–100 score, evidence, confidence |
| Screening decision | **automatic or HR** | see thresholds below |
| Assessment invite | **automatic** | unique token, email, 48h window |
| Sitting | Candidate | timed, autosaved, single-use link |
| Grading | **automatic** | MCQ in code, open questions by AI |
| Assessment decision | **automatic or HR** | pass score + confidence |
| Recorded test | Candidate | camera, mic, fullscreen, proctoring, chunked upload |
| Recorded decision | **automatic or HR** | auto-advances only when proctoring is CLEAN |
| Interview scheduling | HR | date, time, timezone, interviewer, link |
| **Final hire** | **HR, always** | no setting can automate this |

### Decision thresholds (`HRSYSTEM_app_settings`, editable at `/hr/settings`)

```
auto_reject_hard_fail              true     deterministic rules only, never an AI score
auto_shortlist_enabled             true
auto_shortlist_min_score           75
auto_shortlist_min_confidence      0.75
auto_reject_max_score              40
auto_send_assessment               true     after 60 minutes
auto_send_techtest                 true     after 60 minutes
```

---

## 6. What was accomplished

- 45 API routes, 24 tables, 9 migrations, complete pipeline from application to hire.
- A candidate can be parsed, scored, shortlisted, invited, assessed, graded, recorded,
  proctored, evaluated and scheduled **with no human clicks**.
- Every automatic transition writes a plain-language reason to the timeline.
- Every failure path degrades safely: a candidate always reaches a human rather than
  vanishing.
- The pipeline self-heals — a sweep re-runs anything stranded, capped at 3 attempts.

**Measured against the goal:** roughly 160 human decisions per 100 candidates became
around 35. Human effort is now spent only on ambiguous candidates, flagged recordings and
the hire itself.

---

## 7. What is missing

**Blocking before real use**

1. **Email deliverability.** SPF, DKIM and DMARC are not configured. Link-bearing emails
   (every invitation) land in spam. This is the single most important outstanding item —
   candidates never learn they were invited.
2. **Credentials belong to another client.** The OpenAI key and the Gmail account are
   EBF's. Both must move before handover.

**Known gaps**

3. Question library is stored in browser `localStorage` — per-browser, lost on cache clear.
4. `shortlist_threshold` on a job is stored and displayed but not used; the global setting
   decides. Either wire it as a per-job override or remove it.
5. No re-screen path — fixing a job's rules does not re-evaluate existing candidates.
6. Auto-reject sends a rejection email immediately, with no undo.
7. The recorded interview stage has never been run end to end with a successful upload,
   grading and auto-advance in one pass.

---

## 8. What we learned

- **A shaped error beats a silent success.** Most of the lost time came from failures that
  looked like nothing happening. Every early return now records why.
- **Ungraded must never look like zero.** A grading failure rendering as 0% could have
  auto-rejected a strong candidate on a number nobody computed.
- **Fire-once work strands records.** `after()` runs once; a cold start or deploy loses it
  silently. Anything important needs a sweep.
- **Judge meaning, not keywords.** Early prompts penalised candidates for not using the
  exact word. Both prompts now credit demonstrated capability.
- **Unsatisfiable conditions look like disabled features.** Auto-shortlist required
  `missing_requirements` to be empty — never true on a real CV — so it never once fired.
- **Browser proctoring is advisory.** It cannot see a phone or a second computer, and
  fullscreen cannot be enforced. Flag, record, and let a human watch.
