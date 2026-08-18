# HR Recruitment Automation — Next.js MVP

See `ARCHITECTURE.md` for ownership and contracts. See `STACK.md` for libraries.
Database bootstrap lives in `scripts/`.

## Three rules that override everything

**1. No MCP, no connectors.** Cursor never authenticates against Render, Cloudinary, Gmail
or n8n. Every external value is an env var filled in by hand. If a step appears to need a
live credential, print which variable is missing and move on. Never stall waiting on a
login prompt.

**2. No tests.** No test framework, no test files, no `test` script. Verification is
manual.

**3. TypeScript everywhere.** No `.js`/`.jsx` in `src/`. No `any` except where a third
party forces it, and then with a comment saying why.

## Architecture

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

Next.js owns the product. n8n is a function you call for CV parse, screening, grading,
and Gmail send. Full detail: `ARCHITECTURE.md`.

## Folder shape

```
scripts/
  schema.sql          full database (apply once on a fresh DB)
  README.md           create DB, apply schema, verify, set HR password
src/
  app/
    (public)/jobs/…                 candidate pages
    assessment/[token]/…
    tech-interview/[token]/…
    hr/…                            HR pages, guarded by middleware
    api/…                           route handlers (CRUD, cron, automation)
    api/auth/[...nextauth]/route.ts
  auth.ts
  components/
  lib/                              db, pipeline, email, cloudinary, …
  types/
  middleware.ts
```

## Environment

Copy `.env.example` to `.env.local`. All values are server-side except `NEXT_PUBLIC_*`.

```
DATABASE_URL=postgresql://…            # Render, or localhost:5433 in dev
AUTH_SECRET=                           # npx auth secret
AUTH_URL=http://localhost:3000
N8N_AUTOMATION_URL=https://n8n.khghonim.cloud/webhook/hr-automation
AUTOMATION_SECRET=
CLOUDINARY_CLOUD_NAME=  CLOUDINARY_API_KEY=  CLOUDINARY_API_SECRET=
TOKEN_PEPPER=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
```

## Database

Fresh database: apply `scripts/schema.sql` only. Commands, verification queries
(24 `HRSYSTEM_*` tables, 11 email templates, one `HRSYSTEM_app_settings` row), and the HR login password fix are
in `scripts/README.md`.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000. There is no Vercel Cron in this repo — n8n owns the clock
(see `ARCHITECTURE.md` § Scheduling). Locally use the dev-only buttons on `/hr/errors`.
