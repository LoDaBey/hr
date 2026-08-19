# P10 — The auto-reject bug and editor cleanup

One ticket. Read `ARCHITECTURE.md` first.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**

---

## T-38 · CRITICAL — every candidate is being auto-rejected

A candidate scored **85/100** and was auto-rejected with `Missing: ["Military status"]`,
having answered `Completed` when the job accepts `Completed / Exempted / Not applicable`.

**Root cause.** The "Ask military status" control writes a hard requirement with
`op: '=='` and `value` as an **array** of accepted values. `evaluateHardRequirements`
implements `==` only as a scalar compare:

```ts
r.op === '==' ? String(v) === String(r.value) : ...
```

`String(["Completed","Exempted","Not applicable"])` is
`"Completed,Exempted,Not applicable"`, which never equals `"Completed"`. The rule fails
for every candidate, `on_fail` is `RECOMMEND_REJECT`, and auto-reject fires — overriding a
strong score. The "Weak match" badge is the same bug: the hard fail forces the
recommendation to `RECOMMEND_REJECT` on top of the AI's real verdict.

**Fix**

1. Add an `in` operator to the rule type and to `evaluateHardRequirements`: value is a
   list, and the rule passes when the candidate's value is in that list. Compare
   case-insensitively and trimmed.
2. The military-status control writes `op: 'in'`, not `'=='`.
3. **Migrate existing jobs.** Any stored hard requirement with `op === '=='` whose `value`
   is an array becomes `op: 'in'`. Write it as a numbered migration over the
   `hard_requirements` jsonb — do not leave live jobs broken.
4. Keep `==` for genuine scalar equality.

**Guard rails, because auto-reject is destructive:**

- **A hard requirement that cannot be evaluated must never auto-reject.** If the field is
  missing from the candidate's data entirely, treat it as `MANUAL_REVIEW`, never
  `RECOMMEND_REJECT`. Rejecting because we failed to read our own data is the worst
  possible failure mode.
- Log every auto-reject to `HRSYSTEM_recruitment_events` with the **specific rule** that
  failed, the expected value and the actual value. "Hard requirement failed" alone is not
  diagnosable.
- Show that same detail on the candidate profile so HR can see *which* rule rejected them.

**Verify** the exact candidate in the screenshot: age 26 against 20–35, military status
`Completed` against the accepted list, score 85. Must reach `INITIAL_SHORTLISTED` and be
sent an assessment invitation, not a rejection.

---

## T-39 · Candidate list: show work in progress

A new applicant shows blank Score and AI rec while the automations run, which reads as
broken.

- When `screening_results` has no row yet for an application, render **"Screening…"** with
  a small `Loader` in both the Score and AI rec columns.
- The stage rail shows `Applied` as normal.
- SWR should poll the list every 10 seconds while any visible row is in that state, and
  stop polling once none are.

Same treatment on the candidate profile: a "Screening in progress" panel instead of an
empty Screening result block.

---

## T-40 · Job editor cleanup

1. **Duplicate helper text.** Every wizard step renders its description twice — once under
   the stepper, once under the section heading. Steps 3 and 4 are visible examples
   ("How applicants are scored automatically…", "Optional written or coding test sent
   after you shortlist…"). Render it **once**, under the section heading. Fix for all six
   steps, not just the two named.

2. **Rename step 3** from "Screening rules" to **"AI filtering"**, with the single helper
   line: *"How the AI scores each application against this role. You always make the final
   call."*

3. **Description field** on step 1 becomes a `Textarea` with `autosize`, `minRows={8}`,
   `maxRows={20}`. It is currently a two-line box for a full job description.

4. **Delete "Preferred skills"** from the editor. One skills list only — **Required
   skills**. Leave the `preferred_skills` column in place and stop writing to it; the
   screening prompt should drop it from the payload too.

5. **Marital status** — the checkbox alone. Remove the "Marital status field" label and the
   "Candidate will choose their marital status" line. The one-line helper under the
   checkbox already says it is collected but not scored.

---

## T-41 · Dashboard

Remove the floating **"Attention needed: N open workflow errors"** toast. It fires on every
page load and covers the header. The Errors item in the sidebar is enough; put a small
count badge on that nav item instead.

---

## Verify

Apply as a strong candidate to a job with age and military-status rules configured. They
must be auto-shortlisted and receive an assessment invitation. While screening runs, the
candidate list shows a loading state rather than blank cells. The job editor shows each
helper line once, one skills field, a large description box, and no toast on the dashboard.
