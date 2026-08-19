# P12 — Emails are automatic; Send now must actually send

One ticket. Read `ARCHITECTURE.md` first.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**

Auto-advance now works end to end. This ticket removes the manual controls that contradict
that, and fixes the one manual control worth keeping.

---

## T-45 · The Emails list is a log, not a control panel

Every email in the pipeline is queued and sent automatically. A **Send now** button on each
row tells HR the opposite — that email is something they have to push.

- **Remove the Send now button from every row of the Emails section.** All three.
- The Emails section becomes read-only: name, status, delivery time. Nothing clickable
  except **Retry** on a `FAILED` row, which is the only case where a human genuinely has to
  intervene.
- Keep the status wording from P9: *Delivered 00:50*, *Sending shortly*,
  *Scheduled for 01:47*, *Failed — retry*.

The **only** Send now in the product stays on the assessment/tech-test bar, where it means
something specific: skip the configured delay and invite this candidate now.

---

## T-46 · Fix Send now

Clicking it spins forever, `scheduled_for` never changes, no request reaches n8n, and after
a refresh the invite is still scheduled for its original time. The request is failing
server-side and the client never learns.

Two routes are involved and they behave differently — `/api/hr/emails/[id]/send-now`
dispatches inline through `dispatchCommunicationById`, while
`/api/hr/candidates/[id]/assessment/invite/send-now` delegates to `sendInviteNow`. Make
them consistent.

**Requirements**

1. **Add `export const maxDuration = 60;`** to both send-now routes. They call n8n inline;
   without it Vercel kills the function mid-flight and the client sees nothing. This is the
   most likely cause of the hang.
2. **The dispatch must be atomic.** Claim the row before calling n8n — set
   `status`/`attempts` in the same UPDATE that selects it, using
   `FOR UPDATE SKIP LOCKED` semantics like the cron does. Otherwise Send now and the
   5-minute cron can both send the same email, and the candidate gets it twice.
3. **Return the updated state** — the new `status`, `sent_at`, and the sitting's revised
   schedule — so the UI can render the result without a refetch guess.
4. **Always clear the loading state.** Wrap the call in try/finally on the client. A failed
   request must show an error toast with the real message, never an eternal spinner.
5. **On success the bar must change immediately** from "Assessment scheduled — sends at
   01:47" to "Assessment invitation sent 00:53". If it still says scheduled after the call
   returns, the operation did not do what it claimed.
6. **Cancel** must also work and say so: cancel the sitting, cancel the queued email,
   revert the stage, and show "Assessment cancelled".

**Verify** click Send now: within a few seconds the email arrives, an execution appears in
n8n, the bar says sent, and the row in the Emails log says Delivered. Wait past the original
scheduled time and confirm **no second email** is sent.

---

## T-47 · Hide Errors

Remove **Errors** from the sidebar, including the count badge. Leave the route and the page
in place so `/hr/errors` still works if typed directly — it is useful during development —
but nothing in the navigation should point at it.

---

## Verify the whole loop

Submit a strong candidate and touch nothing. Within one cron cycle they should be screened,
scored, auto-shortlisted, emailed, and issued an assessment invitation that sends on
schedule. The only buttons visible to HR on that profile should be the decision bar (when a
decision is genuinely needed) and Send now / Cancel on the assessment bar.
