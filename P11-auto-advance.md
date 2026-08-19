# P11 — Auto-advance actually advances

One ticket. Read `ARCHITECTURE.md` first.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**

---

## T-42 · CRITICAL — auto-shortlist can never fire

A candidate scored **85/100**, **STRONG MATCH**, confidence **0.9**, passed every hard
requirement — and sat at `INITIAL_SCREENING_REVIEW` waiting for a human. No email, no
invite, no transition.

**Root cause.** The auto-shortlist condition requires `missing_requirements` to be empty:

```ts
score >= min_score && confidence >= min_confidence && missing_requirements.length === 0
```

`missing_requirements` is the model's list of things it could not *verify from the CV and
answers* — "TypeScript not explicitly mentioned", "no formal education listed". On a real
CV it is never empty. The gate is unsatisfiable, so auto-shortlist has never once run.

**Fix. Remove the `missing_requirements` condition entirely.** It is informational and
belongs in the UI, not in a decision. The gates that remain:

```
no hard requirement failed        (deterministic, already evaluated in our code)
score      >= auto_shortlist_min_score
confidence >= auto_shortlist_min_confidence
```

Keep `missing_requirements` displayed on the profile so HR can see what the AI could not
confirm. It must not block a transition.

---

## T-43 · Auto-advance at every stage the result is clear

The rule across the pipeline is now: **a clear result advances itself; only an ambiguous or
flagged one waits for a human.** Apply it consistently.

| Stage | Auto-advance when | Human when |
|---|---|---|
| Screening | score ≥ min, confidence ≥ min, no hard fail | anything else |
| Screening | hard rule with `RECOMMEND_REJECT` failed → auto-reject | rule not evaluable → review |
| Technical assessment | `ai_score >= assessment.pass_score` and confidence ≥ min | below pass score, or low confidence |
| Recorded interview | `ai_score >= pass_score`, confidence ≥ min, **and proctoring flag is `CLEAN`** | `MINOR_FLAGS` or `REVIEW_RECORDING`, or a missing recording |
| Final hire | never | always |

**The recorded stage now auto-advances to `FINAL_INTERVIEW_PENDING`** when the answers pass
and the proctoring summary is clean. A flagged recording still goes to a human — nobody
should be advanced or rejected on the strength of a video no one watched.

**The final hire stays human, permanently, with no setting to override it.** It is an offer
of employment, not a stage transition. Everything up to it can run unattended.

Add to `HRSYSTEM_app_settings` (migration, folded into `schema.sql`):

```
auto_advance_assessment          boolean NOT NULL DEFAULT true
auto_advance_recorded            boolean NOT NULL DEFAULT true
auto_advance_min_confidence      numeric(3,2) NOT NULL DEFAULT 0.75
```

Every automatic transition writes a `HRSYSTEM_recruitment_events` row with
`actor_type = 'SYSTEM'` and a plain-language reason — "Auto-shortlisted: score 85 ≥ 75,
confidence 0.9, all must-haves met" — so the timeline explains itself without anyone
reading code.

---

## T-44 · The decision bar should reflect who is deciding

The green **Shortlist** bar currently renders identically whether the system is waiting on
HR or has already moved on.

- When an application is at a review stage **because it was flagged**, show the decision bar
  with a line above it: *"Needs your decision — {reason}"*, where the reason is the actual
  cause (score below threshold, low confidence, proctoring flags, a rule that could not be
  evaluated).
- When a stage was passed **automatically**, show no decision bar for it. Show
  *"Auto-advanced on 19 Aug 23:45"* instead.
- HR can still override any automatic decision — put that behind a small **Override**
  action, not the primary button. The default state of this page should be reading, not
  clicking.

---

## Verify

Re-submit the same strong candidate. With no human input they must: be screened, be
auto-shortlisted, receive the shortlist email, be issued an assessment invite, and receive
that email — all within one cron cycle. The timeline must state why each step happened. A
candidate scoring below the threshold must stop at review with the reason named.
