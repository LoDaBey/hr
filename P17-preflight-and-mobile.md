# P17 — Preflight deadlock, screen share, and mobile

One ticket. Read `apps/web/ARCHITECTURE.md` and `apps/web/STACK.md` first.
**No MCP. No tests. TypeScript only. Every colour from `theme.ts`.**
**Do not read Vercel logs. Do not query the database. Do not push to GitHub.**

---

## T-61 · CRITICAL — the camera preview never appears

Chrome reports **Camera: Using now** and **Microphone: Using now**, so `getUserMedia`
succeeded and the tracks are live. The preview still shows a spinner forever and
**Start session** never enables. The candidate cannot take the interview at all.

**Cause.** The `<video>` element is rendered *conditionally* — the loader replaces it while
`mediaState === 'requesting'`. So when the stream resolves and the code assigns
`videoRef.current.srcObject`, the ref is still `null`. The video never receives the stream,
never fires `loadedmetadata`, so the state never leaves `requesting`, so the video never
renders. A deadlock that only appears when the stream resolves faster than the render.

**Fix**

1. **Always render the `<video>`.** Never unmount it behind a loader. Overlay the spinner on
   top of it and remove the overlay when the first frame arrives.
2. Attach the stream with a **callback ref**, not `useRef` + effect, so assignment happens
   the moment the element exists regardless of ordering:
   ```tsx
   const attach = useCallback((el: HTMLVideoElement | null) => {
     videoRef.current = el;
     if (el && streamRef.current && el.srcObject !== streamRef.current) {
       el.srcObject = streamRef.current;
       void el.play().catch(() => {});
     }
   }, []);
   ```
   Also assign in the place where the stream is acquired, guarded on the element existing.
3. The video element needs **`playsInline`, `muted`, `autoPlay`**. Without `playsInline`,
   iOS Safari refuses to render inline and takes over the screen.
4. **Drive readiness from the element, not from the promise.** Set the preview to ready on
   `loadedmetadata` (or `canplay`), not immediately after `getUserMedia` resolves.
5. **Add a timeout.** If no frame arrives within 10 seconds, leave `requesting` and show
   *"We could not display your camera. It may be in use by another application — close
   other video apps and retry."* with a Retry. **Nothing on this page may spin forever.**

**Verify** with the camera already granted, on a fresh load, on a reload mid-session, and
with the camera busy in another app. The preview appears or an error does — never a
permanent spinner.

---

## T-62 · Screen share: reject anything that is not the whole monitor

The picker's Tab and Window tabs **cannot be removed.** The browser owns that dialog and the
specification deliberately preserves the user's choice. No web API hides those options.

What we can do is refuse the result.

1. Request with the strongest hints available:
   ```ts
   navigator.mediaDevices.getDisplayMedia({
     video: { displaySurface: 'monitor' },
     audio: false,
     // @ts-expect-error - not yet in lib.dom
     monitorTypeSurfaces: 'include',
     surfaceSwitching: 'exclude',
     selfBrowserSurface: 'exclude',
   })
   ```
   `displaySurface: 'monitor'` pre-selects the Entire Screen tab. `surfaceSwitching:
   'exclude'` stops them switching surface mid-session. `selfBrowserSurface: 'exclude'`
   hides this tab from the picker.

2. **Verify and reject.** After the promise resolves, read
   `track.getSettings().displaySurface`. If it is not `'monitor'`:
   - `track.stop()` immediately — do not keep a tab share alive
   - show *"That shared a single tab. This session needs your entire screen — choose the
     Entire Screen tab and try again."*
   - re-prompt on the same button; loop until it is `'monitor'` or they give up
   - **Start stays disabled.** A warning that can be ignored is not a requirement.

3. If the share ends mid-session, the existing `SCREEN_SHARE_STOPPED` CRITICAL and blocking
   overlay already handle it — confirm they still fire after this change.

---

## T-63 · Mobile: block it honestly, and say so early

`navigator.mediaDevices.getDisplayMedia is not a function` on the phone is not a bug.
**No mobile browser implements screen capture** — not Chrome on Android, not Safari on iOS.
It is not coming. A recorded test that requires screen share is desktop-only, permanently.

1. **Feature-detect, do not assume.** At preflight, when `require_screen_share` is on and
   `typeof navigator.mediaDevices?.getDisplayMedia !== 'function'`, show a blocking panel:

   > **Use a desktop or laptop**
   > This session records your screen, which phones and tablets do not support. Open this
   > link on a computer using Chrome, Edge or Firefox. Your invitation link still works —
   > nothing has been used up.

   No Retry, no Start. Do not show a raw error message to a candidate.

2. **Only block when screen share is required.** Camera and microphone work fine on mobile.
   If `require_screen_share` is off, let the session run on a phone.

3. **Tell them before they get there.** The `TECHTEST_INVITE` email must say, when screen
   share is required: *"This session must be taken on a desktop or laptop computer."* A
   candidate discovering this at 11pm on their phone is a bad experience we can prevent
   with one sentence.

4. Show the same requirement on the preflight page **above** the framing check, not only
   after a failure.

---

## T-64 · Trim the rules list

The generated list now runs to nine bullets, several overlapping — *"Do not switch tabs or
use another application"*, *"Do not leave the session"*, *"Do not use any other browsers"*
say the same thing three ways.

Keep it to what is enforced or detected:

- This session is recorded
- Do not switch tabs or use another application
- Your camera must stay on for the whole session *(if required)*
- Your microphone must stay on for the whole session *(if required)*
- Stay in fullscreen — leaving it is recorded *(if required)*
- Share your entire screen, not a single tab or window *(if required)*
- Use a desktop or laptop *(if screen share required)*

Delete the rest. A rule nobody checks teaches candidates the rules are decorative.

---

## Verify

Take a recorded test on a desktop with the camera already granted — the preview appears
within a second. Share a Chrome tab instead of the screen — it is rejected and Start stays
disabled until you share the monitor. Open the same link on a phone — a clear "use a
computer" panel, no raw error, no spinner.
