# P9 — Profile layout and the email pipeline

One ticket. Read `ARCHITECTURE.md` first.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**

---

## T-35 · Stop stacking. Use the width.

The profile is a single column of full-width cards, so a two-line answer occupies a quarter
of a 2500px screen and the rest is white. Rebuild as a responsive grid.

**Layout** — `Grid` with a 12-column span, `lg` breakpoint. Below `lg` everything falls back
to one column.

```
┌─────────────────────────── header: name, contact, stage rail ──────────────────────────┐
├──────────────────────── decision bar (sticky, full width) ─────────────────────────────┤
│  Application answers            (7 cols)  │  CV + parsed profile        (5 cols)       │
├────────────────────── Screening result (full width) ───────────────────────────────────┤
│  Emails                         (5 cols)  │  Timeline                   (7 cols)       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Application answers and CV sit side by side.** Personal/Professional/Questions on the
  left, the CV button and the parsed profile on the right.
- **Emails and Timeline sit side by side**, both rendered as vertical event lists with the
  same visual treatment — Emails is a communication log, Timeline is a state log, they
  belong at the same rank.
- Screening result stays full width; it holds long prose and three lists.
- Cards must not have a fixed height. Let each column size to its content and align to the
  top.

Anything left in a single stacked column is a failure of this ticket.

---

## T-36 · Fix the email pipeline

Four distinct bugs. Diagnose each before changing anything.

### 36.1 — "Queued email not found"

`POST /api/hr/emails/[communicationId]/send-now` runs
`UPDATE ... WHERE c.id = $1 AND c.status = 'PENDING' AND c.application_id = a.id`.
The 404 means that matched nothing.

**Check first:** does `GET /api/hr/candidates/[applicationId]` actually return the
communication row's **`id`**? If it selects `template_key, status, to_email, created_at,
sent_at` but not `id`, the UI calls `/api/hr/emails/undefined/send-now` and produces exactly
this error. Add `c.id` to the select and type it on the client.

Then confirm the row's `application_id` is not NULL — the route joins on it, so a null makes
the UPDATE match nothing even when the id is right.

### 36.2 — Duplicate invitations

The profile shows **two** "Technical assessment invitation" rows: one queued 18:37 and sent
18:40, another queued 20:09 still pending. A resend must not leave the old one alive.

- When `issueInvite` cancels the previous sitting, it must also mark that sitting's
  **queued but unsent** communication `CANCELLED`. Already-sent emails stay as history.
- `ON CONFLICT (dedupe_key) DO NOTHING` currently means a resend can silently insert
  nothing. Confirm the `dedupe_key` includes the new sitting id so each resend gets its own
  row — and if the insert is skipped, log it rather than pretending it worked.

### 36.3 — Ordering and grouping

Order strictly newest first by `created_at`. Right now a 20:09 row sits above an 18:40 row
above another 18:40 row above 16:30, which reads as random. Group under a date heading like
the timeline, and show relative time ("2 hours ago") with the exact time on hover.

### 36.4 — Say what is actually happening

- `Sent` → "Delivered 18:40" .
- `PENDING` with `scheduled_for` in the future → "Scheduled for 21:09" **with the real
  time**, not "sending within 5 minutes". A 60-minute auto-send delay currently displays as
  5 minutes, which is a lie.
- `PENDING` with `scheduled_for` in the past → "Sending shortly".
- `FAILED` → the error and a Retry button.
- `CANCELLED` → "Cancelled — superseded by a newer invitation".

**Send now** must set `scheduled_for = now()` **and** trigger a dispatch immediately rather
than waiting for the next cron tick. HR pressing a button expects an email, not a promise.

---

## T-37 · Screening result

Close to right already. Three changes:

- The three lists (**Strengths**, **Weaknesses**, **Missing**) go in a 3-column grid on
  `lg`, stacked below it. They are currently one long column of bullets that pushes the
  reasoning paragraph off screen.
- **Missing** is the most actionable list — put it first and give it the warning colour.
  It is what tells HR why the candidate was not auto-advanced.
- Score gets a visual weight: large number, recommendation word beside it, confidence as a
  small muted line. It is the first thing HR looks for and currently reads like body text.

---

## Verify

Open a candidate on a 1920px screen: two columns throughout, no card wider than its
content needs, no vertical stack of full-width blocks. Press **Send now** on a queued email
and receive it within seconds. Resend an assessment invitation and see exactly one live
queued row, with the superseded one marked cancelled.
