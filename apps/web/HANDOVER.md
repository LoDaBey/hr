# HR Recruitment Automation — Handover

Verified 20 Aug 2026 against the codebase and the live n8n workflow. No facts from memory.

**Live:** `https://hr-flax-beta.vercel.app` · n8n `https://n8n.khghonim.cloud` · PostgreSQL on Render.

---

## 1. Architecture, and why

```
Browser
  │
  ▼
Next.js 15 + TypeScript  (Vercel)  ←──→  PostgreSQL (Render, direct `pg`)
  owns: all SQL, all state, all business rules, auth, every decision
  │
  │  POST /webhook/hr-automation   { task, payload }
  ▼
n8n "HR Automations"  (VPS, 38 nodes)
  owns: six stateless AI/email tasks. No database. No auth. No state.
```

The original spec put n8n in charge of everything — 19 workflows acting as API, data layer
and business logic. That was built (`WF-HR-CORE`, 189 nodes) and abandoned on 16 Aug: no
types, no transactions, no way to test, rules scattered across dozens of Code nodes.

**The rule since:** if it touches the database or decides anything, it is TypeScript. If it
calls a model or sends mail, it is n8n. That boundary has held and is worth defending.

**Stack:** Next.js 15 App Router · Mantine 9 · SWR · NextAuth v5 Credentials against
Postgres `crypt()` · Cloudinary (CVs, recordings) · framer-motion · recordrtc.

---

## 2. n8n — exactly how it works

**Workflow `HR Automations`, id `Gu2wYqDFJlmrujrD`, 38 nodes, active, published.**

**Entry:** `POST /webhook/hr-automation`, header `x-automation-secret` (Header Auth
credential — n8n Variables are a paid feature here, so credentials carry secrets).

```
Webhook → FN Guard (validates task) → SW Task (switch, 6 rules + fallback)
```

### The six tasks

| Task | Path | Returns |
|---|---|---|
| `cv.parse` | Download CV → Extract PDF → **AI Parse CV** | structured CV + raw text |
| `screening.run` | Prep → **AI Screen Candidate** | score 0–100, decision, confidence, strengths, weaknesses, missing, evidence |
| `assessment.grade` | Prep → **AI Grade Answers** | per-question score, concepts covered/missed, errors, feedback |
| `email.send` | **Gmail Send** (3 retries, 2s apart) | message id |
| `recording.grade` | Download audio → **OpenAI Transcribe** → **AI Grade Recording** | transcript + per-question results |
| *(fallback)* | FN Unknown Task | 404 shaped error |

All four LLM nodes are `chainLlm` on **`gpt-4.1-mini`, temperature 0**, each with a
Structured Output Parser. Deterministic — the same input scores the same twice.

Every branch ends at `Respond OK` (`{ok:true,data}`) or `Respond Error`
(`{ok:false,error}`). CV download, PDF extract, audio download and Gmail all have error
outputs wired.

### The schedule
`Schedule: every 5 min` fans out to four Next.js routes, each Bearer `CRON_SECRET`:
`/api/cron/email-dispatch` · `deadline-monitor` · `interview-reminders` · `pipeline-sweep`.
There is **no Vercel Cron**. n8n owns the clock; Next.js owns what happens.

### Three rules learned painfully
1. **Publish after every change.** n8n serves the *published* version; a saved draft is not
   live.
2. **Never enable "Ignore Bots" on a server-to-server webhook.** It rejects with
   `403 Authorization data is wrong!` *before* the auth check — indistinguishable from a bad
   secret. Node's `fetch` user agent is flagged as a bot; PowerShell's is not. This cost the
   longest debugging session of the project.
3. **The schedule interval silently loses its value.** Three times now the rule has come
   back as `{field:"minutes"}` with no `minutesInterval`, firing every minute instead of
   every five. Check it after any workflow edit.

---

## 3. Database

**24 tables, all prefixed `HRSYSTEM_`** so the schema can be applied to a shared production
database without collision. Postgres folds unquoted identifiers, so they exist as
`hrsystem_*`.

`apps/web/scripts/schema.sql` is canonical — every migration folded in. A fresh database
needs only that file. **Migrations 005–013** are the incremental record.

**No seeded user.** Create the first HR account with `INSERT … crypt(…)`; see
`scripts/README.md`.

`recruitment_events` blocks UPDATE (history cannot be rewritten) but allows DELETE to
cascade, so deleting a job or honouring a right-to-erasure request still works.

---

## 4. The pipeline

| Stage | Who acts |
|---|---|
| Job created (6-step wizard, publish, share link) | HR |
| Application (public form, CV to Cloudinary) | Candidate |
| CV parse · hard requirements · screening | **automatic** |
| Screening decision | **automatic or HR** |
| Assessment invite (unique token, 48h window) | **automatic** |
| Sitting (timed, autosaved, single-use link) | Candidate |
| Grading (MCQ in code, open questions by AI) | **automatic** |
| Assessment decision | **automatic or HR** |
| Recorded test (camera, mic, fullscreen, proctoring, chunked upload, written or spoken) | Candidate |
| Recorded evaluation (+ transcription for spoken) | **automatic** |
| Recorded decision | **automatic when proctoring is CLEAN, else HR** |
| Interview scheduling | HR |
| **Final hire** | **HR, always — no setting overrides this** |

### Decision thresholds

Global, at `/hr/settings`: `auto_shortlist_min_score` 75 · `auto_shortlist_min_confidence`
0.75 · `auto_reject_max_score` 40 · `auto_reject_hard_fail` true · invite delays 60 min.

**Per job:** `shortlist_threshold` overrides the global shortlist bar when set. The reject
floor stays global.

**Auto-reject fires only on deterministic hard rules** — age, military status — evaluated
in TypeScript. Never on an AI score, never on free text. If a rejected candidate asks why,
the answer must be arithmetic and auditable.

---

## 5. What was accomplished

45 API routes · 24 tables · 9 migrations · full pipeline from application to hire.

A candidate can be parsed, scored, shortlisted, invited, assessed, graded, recorded,
transcribed, proctored, evaluated and scheduled **with no human clicks**. Every automatic
transition writes a plain-language reason to the timeline. Every failure degrades safely —
a candidate reaches a human rather than vanishing. A sweep re-runs anything stranded,
capped at 3 attempts.

**Roughly 160 human decisions per 100 candidates became about 35.** HR now spends its
attention on ambiguous candidates, flagged recordings, and the hire itself.

---

## 6. What is missing

**Blocking before real use**

1. **Email deliverability.** SPF, DKIM and DMARC are not configured. Link-bearing emails —
   every invitation — land in spam. Nothing else matters more: the system works perfectly
   and no candidate learns they were invited.
2. **Credentials belong to another client.** The OpenAI key and Gmail account are EBF's.
   Both must move before handover.

**Known gaps**

3. P17 (camera preview deadlock, screen-share enforcement, mobile block) is written but only
   partly applied — migration 013 exists, the rest is unverified.
4. Spoken answers have never been run end to end: record → transcribe → grade.
5. Question library lives in browser `localStorage` — per-browser, lost on cache clear.
6. No re-screen path; fixing a job's criteria does not re-evaluate existing candidates.
7. Auto-reject emails immediately, with no undo.
8. Recorded tests requiring screen share are desktop-only — no mobile browser implements
   `getDisplayMedia`, and none will.

---

## 7. What we learned

- **A shaped error beats a silent success.** Most lost time came from failures that looked
  like nothing happening.
- **Ungraded must never look like zero.** A grading failure rendering as 0% could
  auto-reject a strong candidate on a number nobody computed.
- **Fire-once work strands records.** `after()` runs once; a cold start loses it silently.
- **Judge meaning, not keywords.** Early prompts penalised candidates for not using the
  exact word.
- **Unsatisfiable conditions look like disabled features.** Auto-shortlist required
  `missing_requirements` to be empty — never true on a real CV — so it never once fired.
- **Browser proctoring is advisory.** It cannot see a phone or a second computer, and
  fullscreen cannot be enforced. Flag, record, let a human watch.
