# P14 — Grading must be able to recover

One ticket. Read `ARCHITECTURE.md` and `STACK.md` first — the standing rules apply.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**
**Do not read Vercel logs. Do not query the database. Do not push to GitHub.**

---

## T-51 · A submitted sitting must never be stranded

Grading fires exactly once, from `after()` on submit. If that single attempt fails — a
timeout, a cold start, an n8n blip, a deploy mid-request — the sitting sits at `SUBMITTED`
with no evaluation and nothing will ever retry it. The candidate waits, HR waits, and the
UI honestly reports "Awaiting grading" forever.

The same applies to `evaluateTechTest` and to `runCvParseAndScreening`. All three are
fire-once, and all three can strand a candidate.

### 51.1 — A sweep that heals

Add `src/app/api/cron/pipeline-sweep/route.ts`, same Bearer `CRON_SECRET` guard and
`maxDuration = 60` as the other cron routes.

Each run, claim a small batch (5) with `FOR UPDATE SKIP LOCKED` and re-run the missing
step:

| Condition | Action |
|---|---|
| `candidate_assessments.status = 'SUBMITTED'`, kind `ASSESSMENT`, no overall evaluation row, `submitted_at` older than 3 minutes | `gradeAssessment(id)` |
| same for kind `TECH_TEST` | `evaluateTechTest(id)` |
| `applications.stage IN ('APPLICATION_RECEIVED','CV_PROCESSING')`, no `screening_results` row, `created_at` older than 5 minutes | `runCvParseAndScreening(id)` |

**Rules**

- Add a `grading_attempts` integer to `HRSYSTEM_candidate_assessments` and a
  `screening_attempts` to `HRSYSTEM_applications` (migration, folded into `schema.sql`).
  Increment on each sweep attempt. **Stop at 3** and write a `HRSYSTEM_workflow_errors`
  row — an infinite retry loop against a paid model is worse than a stuck record.
- The 3-minute and 5-minute delays exist so the sweep never races the original `after()`
  call and double-grades.
- Log each recovery as a `recruitment_events` row with `actor_type = 'SYSTEM'` and a reason
  like "Grading retried by sweep (attempt 2)", so the timeline explains the gap.

### 51.2 — Wire it to the schedule

The n8n `Schedule: every 5 min` trigger already fans out to three cron URLs. This is a
fourth Next.js route; add the node to the fan-out yourself in n8n, or tell me the route is
ready and I will add it.

### 51.3 — Give HR a manual escape

On the assessment and recorded-test review panels, when the state is "Awaiting grading" and
`submitted_at` is more than 5 minutes ago, show a **Grade now** button that calls the same
function directly. Same discipline as Send now: `maxDuration = 60`, clear the loading state
in `finally`, show the real error on failure.

This is the only manual control worth adding here — everything else self-heals.

---

## Verify

Submit an assessment, then confirm it grades on its own. Separately, take a sitting that is
`SUBMITTED` with no evaluation and confirm the sweep picks it up within one cycle and either
grades it or, after three attempts, records a failure that HR can see. Confirm no sitting is
graded twice.
