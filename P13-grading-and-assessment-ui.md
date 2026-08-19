# P13 — Grading never runs, and the assessment page

One ticket. Read `ARCHITECTURE.md` and `STACK.md` first — the standing rules there apply.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**
**Do not read Vercel logs. Do not query the database. Do not push to GitHub.**

---

## T-48 · CRITICAL — the assessment is never graded

A candidate submitted a TEXT answer. The timeline recorded "assessment submitted". The
review shows **0% (0/10)** and "No evaluation yet", and **no `assessment.grade` call ever
reached n8n**.

The wiring is already correct — `submit/route.ts` has `maxDuration = 60` and calls
`after(() => gradeAssessment(sittingId))`, and `gradeAssessment` calls
`runAutomation('assessment.grade', …)` whenever `openForAi.length > 0`. Something in
between returns early **without leaving any trace the product can show**. That is the real
defect, and it is what this ticket fixes. Do not go hunting in logs.

### 48.1 — Remove the race

`gradeAssessment` re-reads the sitting and bails when the status is not `SUBMITTED`:

```ts
if (sitting.status !== 'SUBMITTED') { console.info('[grading] skip …'); return; }
```

The submit route already knows the status it just wrote. **Pass it in** —
`gradeAssessment(sittingId, { expectedStatus: 'SUBMITTED' })` — and trust the caller
instead of re-reading. Keep the guard for any other caller, but a freshly committed submit
must never be skipped because of read timing.

### 48.2 — No silent exits

Every path in `gradeAssessment` and `evaluateTechTest` that returns without grading must
first write a `HRSYSTEM_workflow_errors` row naming the reason, and set the sitting's
overall evaluation feedback to something honest. The reasons to cover explicitly:

- sitting not found
- status not gradeable
- no questions configured on the assessment
- questions exist but no answers were stored
- open questions exist but `openForAi` came out empty
- `runAutomation('assessment.grade')` returned `ok: false`

Each one is a different bug with the same current symptom. After this ticket they are
distinguishable from the HR screen alone.

### 48.3 — Ungraded must not look like zero

`AssessmentReview` currently falls back to
`Math.round((totalScore / totalMax) * 100)`, so zero evaluation rows renders as a confident
**0%**. Replace that:

- No overall evaluation row and the sitting is `SUBMITTED` → **"Awaiting grading"** with a
  spinner, and poll every 10s until it resolves.
- An error row exists for this sitting → **"Grading failed — review manually"** with the
  reason.
- Only show a percentage when an overall evaluation row genuinely exists.

### 48.4 — Auto-advance must not act on nothing

Gate the assessment auto-advance on an overall evaluation row **existing**, not on
`ai_score` being falsy. A grading failure currently reads as a score of zero, which with
auto-advance live could reject a strong candidate on a number that was never computed.
That is the most dangerous bug in this ticket.

**Verify** submit a one-question TEXT assessment. Within a minute the review shows a real
score with per-question feedback — or an explicit failure with a reason on screen. Never a
silent 0%.

---

## T-49 · Recompute the deadline from the actual send

`invite_deadline` is set from the **scheduled** send time, so a delayed, retried or
manually-sent invitation gives the candidate a shortened window.

When a communication with `template_key` `ASSESSMENT_INVITE` or `TECHTEST_INVITE` is marked
`SENT`, recompute that sitting's `invite_deadline` as `sent_at + <job invite hours>` and
update `HRSYSTEM_access_tokens.expires_at` to match. Record it as a `recruitment_events`
row.

Show the real send time on the HR bar: **"Invitation sent 01:15 · must start by 23 Aug
01:15"**.

---

## T-50 · The candidate assessment page

The content floats mid-screen, the buttons move between questions, and point values are
exposed to the candidate.

- **Layout** — centred column, `maw={720}`, generous top padding, same restraint as the
  application form. The question card takes a **fixed minimum height** so Prev/Next never
  shift position as the candidate moves between questions.
- **Hide the points.** `10 points` is HR-only. Remove it from the sitting page; keep it in
  the HR review panel.
- **Navigation** — the primary button is **Next** on every question except the last, where
  it becomes **Submit**. **Prev stays enabled throughout** — answers autosave on change, so
  going back costs nothing, and trapping a candidate on a question measures their nerve
  rather than their ability. Only Submit is final.
- The left rail keeps the answered/unanswered state and allows jumping directly.
- Submit opens a confirm listing unanswered questions, then locks the sitting.
- Countdown and position ("2 of 5") stay visible once started.

---

## Verify

Take an assessment end to end as a candidate: nothing moves as you navigate, Prev works, no
point values are visible, Submit confirms. Within a minute HR sees a real score with
per-question feedback, or an explicit failure with its reason — never a silent 0%.
