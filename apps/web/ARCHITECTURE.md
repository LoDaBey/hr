# Architecture — final

Supersedes every earlier version. Where any ticket disagrees with this file, this file wins.

## Ownership

```
Browser
   │
   ▼
Next.js on Vercel ──────────── Render PostgreSQL
  Frontend + Backend            (direct connection, `pg`)
  Auth (NextAuth)
  All routes, all CRUD
  All business rules
   │
   │  POST /webhook/hr-automation   { task, payload }
   ▼
n8n  "HR Automations"
  Stateless. No DB. No auth. No CRUD.
  Returns a result; Next persists it.
```

| Layer | Owns | Never does |
|---|---|---|
| **Next.js** | UI, routes, auth, sessions, every SQL query, the state machine, validation, idempotency, rate limits, email templating, scheduling | calls n8n for anything it can do itself |
| **Render Postgres** | all durable state | is touched by anything except Next.js |
| **n8n** | CV parsing, AI screening, AI grading, sending Gmail | reads or writes the database, authenticates users, holds state, exposes CRUD |
| **Cloudinary** | CV files, interview recordings | — |

**The rule:** n8n is a function you call. It takes JSON in, returns JSON out, and remembers
nothing. If a task needs to know what happened last time, it belongs in Next.js.

## The n8n contract

One endpoint. `POST {N8N_AUTOMATION_URL}` with header `x-automation-secret`.

```jsonc
{ "task": "cv.parse", "payload": { }, "request_id": "uuid" }
```
```jsonc
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

### `cv.parse`
```jsonc
payload: { "cv_url": "https://res.cloudinary.com/...signed..." }
data:    { "parsed": { "full_name", "years_experience", "skills": [], "technologies": [],
                       "work_experience": [], "education": [], "languages": {},
                       "certifications": [], "projects": [] },
           "raw_text": "..." }
```
PDF only. Next.js stores `parsed` and `raw_text` into `documents`; n8n writes nothing.

### `screening.run`
```jsonc
payload: { "job": {...}, "candidate_answers": {...}, "cv_parsed": {...},
           "hard_requirement_failures": [...] }
data:    { "score", "decision", "confidence", "strengths": [], "weaknesses": [],
           "missing_requirements": [], "evidence": [], "reasoning_summary" }
```
**Hard requirements are evaluated in Next.js, in code, before the call.** The result is
passed in as context and overrides whatever the model says. A model cannot rescue a
candidate who failed a hard rule.

### `assessment.grade`
```jsonc
payload: { "questions": [{ "question_id", "type", "prompt", "rubric", "max_score", "answer" }] }
data:    { "results": [{ "question_id", "score", "max_score", "correct_concepts": [],
                         "missing_concepts": [], "technical_errors": [], "feedback",
                         "confidence" }] }
```
MCQ is scored in Next.js against `correct_key` — never sent to n8n, never sent to a model.

### `email.send`
```jsonc
payload: { "to", "subject", "html", "from_name" }
data:    { "message_id", "thread_id" }
```
**Next.js renders the template.** n8n receives finished HTML and sends it. Templates,
variables and escaping stay in Next.js where the data lives.

## What moved out of n8n

Everything that was in `WF-HR-CORE`: the action router, `auth.login`, JWT signing, the
idempotency table, rate limiting, the email outbox, Cloudinary signing, every Postgres
node, every stage transition. All of it is now Next.js route handlers. **Delete
`WF-HR-CORE`** — keeping it around invites someone to wire it back up.

## Auth

NextAuth Credentials. `authorize()` queries Postgres directly:

```sql
SELECT id, email, full_name, role FROM HRSYSTEM_users
WHERE email = $1 AND is_active AND password_hash = crypt($2, password_hash);
```

pgcrypto does the comparison inside the database, so the hash never travels. No JWT is
minted for n8n — n8n has no concept of a user any more. The session cookie holds
`{ id, name, email, role }` and nothing else.

## Scheduling

There is no Vercel Cron. **n8n owns the clock**, Next.js still owns the work.

A Schedule Trigger in the `HR Automations` workflow fires every 5 minutes and fans out to
three HTTP Request nodes, each POSTing to a Next.js route with a Bearer `CRON_SECRET`:

| n8n node | Calls | Does |
|---|---|---|
| `CRON · Email Dispatch` | `/api/cron/email-dispatch` | claim PENDING `communications`, render, call `email.send`, mark SENT |
| `CRON · Deadline Monitor` | `/api/cron/deadline-monitor` | expire sittings, queue reminders |
| `CRON · Interview Reminders` | `/api/cron/interview-reminders` | 24h and 2h reminders |

n8n does not read the database to do this. It knows only *when*; Next.js decides *what*.
The email dispatcher then calls back into n8n's `email.send` to actually send — two hops,
which costs nothing on a five-minute schedule and keeps the ownership rule intact.

The trigger ships **disabled** with placeholder URLs. Enable it once the app is deployed and
the three URLs point at it. Locally there is no scheduler at all — use the dev-only buttons
on `/hr/errors`.

Each cron route rejects anything without `Authorization: Bearer $CRON_SECRET`. In n8n that
is a Bearer Auth credential selected on all three HTTP Request nodes — never a hardcoded
header, since n8n Variables are a paid feature on this instance.

## Long-running calls

`cv.parse` and `screening.run` take seconds, not milliseconds. The application submit route
must **not** await them — it writes the application, returns 200 to the candidate, then
triggers the automation. Use `after()` from `next/server`, or a `PENDING` row picked up by
the cron. Never make a candidate watch a spinner while a model thinks.

## Security

| Surface | Control |
|---|---|
| HR routes | NextAuth session; `role` checked server-side in the route handler, not just middleware |
| Candidate routes | random token, `sha256(token + TOKEN_PEPPER)` compared in SQL |
| n8n | `x-automation-secret`; the URL is server-side only and never reaches the browser |
| Postgres | connection string server-side only; `pg` pool in `lib/db.ts` with `import 'server-only'` |
| Cloudinary | signature computed in a Next route handler with the API secret; browser uploads direct |
| SQL | parameterised always, `$1, $2` — never interpolation |

## Database

Apply `scripts/schema.sql` once on a fresh Postgres. There is no separate `infra/db`
tree and no migration runner — the file already contains the full shape plus seed data.
Bootstrap commands and verification queries: `scripts/README.md`.

## Environment

```
DATABASE_URL=postgresql://…            # Render, or localhost:5433 in dev
AUTH_SECRET=                           # npx auth secret
AUTH_URL=http://localhost:3000
N8N_AUTOMATION_URL=https://n8n.khghonim.cloud/webhook/hr-automation
AUTOMATION_SECRET=                     # matches n8n's $env.AUTOMATION_SECRET
CLOUDINARY_CLOUD_NAME=  CLOUDINARY_API_KEY=  CLOUDINARY_API_SECRET=
TOKEN_PEPPER=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
```

n8n needs exactly one variable: `AUTOMATION_SECRET`. Plus the AI and Gmail credentials.

## What this costs you

Worth saying plainly, because the client's original spec asked for the opposite:

- Business logic now lives in Vercel functions rather than a visual workflow the client can
  inspect. They lose the "open n8n and see the pipeline" story.
- n8n's execution log no longer shows the recruitment pipeline — only four AI/email calls.
  Debugging a stuck candidate means Vercel logs and SQL, not the n8n canvas.
- If the client ever asks to "change the flow without a developer", that is now a code
  change.

In exchange: one language, one deploy, real types end to end, direct database access, and
no webhook round-trip on every page load. For an MVP built by one developer, that trade is
usually right — but it is a trade, and the client should hear it from you rather than
discover it.
