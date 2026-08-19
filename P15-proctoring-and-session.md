# P15 — Recorded interview: integrity, grading, and the session UI

One ticket. Read `ARCHITECTURE.md` and `STACK.md` first — the standing rules apply.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**
**Do not read Vercel logs. Do not query the database. Do not push to GitHub.**

---

## T-52 · Grading: a stale failure must not outlive a success

The recorded test graded fine — 4/10 with real per-question feedback — while the panel
simultaneously showed **"Grading failed — review manually · This operation was aborted"**.
An earlier attempt was killed, wrote an error row, and a later attempt succeeded. The error
row was never superseded.

- When grading completes successfully, **resolve any open `HRSYSTEM_workflow_errors` rows
  for that sitting** (set `resolved = true`). The failure banner reads from unresolved rows
  only.
- Never render a failure banner and a real score together. If an overall evaluation row
  exists, that is the truth; the earlier attempt is history.
- The first attempt was killed mid-flight: confirm `export const maxDuration = 60;` is
  present on the **tech-test submit route** as well as the assessment one. `after()` work
  dies with the function without it.

---

## T-53 · Start must require live devices, and stay that way

You reached the questions with the camera and microphone off. The Start button enabled on
the checkbox alone; only a reload surfaced "Device access needed".

- **Start stays disabled** until there is a live `MediaStream` with an active video track
  (and audio track when `require_mic`). The rules checkbox alone is never enough.
- Show the real device state next to the preview — **Camera on · Microphone on**, or the
  blocking error with Retry. A black preview must never sit under an enabled Start.
- **During the session**, if a required track ends or is muted: record `CAMERA_OFF` /
  `MIC_OFF` as CRITICAL, pause the countdown, and show a blocking overlay — *"Recording
  stopped. Restore your camera to continue."* — with a Resume that re-acquires the stream.
  Do not let the session continue silently without a recording.
- Recording must be confirmed started before the first question renders.

---

## T-54 · Proctoring that actually flags something

The candidate answered from a second monitor and the summary said **"No proctoring flags"**.
Three real gaps.

### 54.1 — Detect a second display

`window.screen.isExtended` is a boolean available in Chromium with no permission prompt. It
is the one genuine multi-monitor signal a browser offers.

- Check it at **preflight**. If true, show a blocking notice: *"A second display was
  detected. Please disconnect it before starting."* Re-check on Retry.
- Check it again on an interval **during** the session. If it becomes true, record
  `EXTERNAL_DISPLAY` as **CRITICAL** and show a persistent banner.
- Store the preflight result on the sitting so HR sees "Started with a second display
  connected" even if it was unplugged later.

### 54.2 — Fix the severities

Losing window focus during a recorded, fullscreen, timed test is not informational.

| Event | Now | Should be |
|---|---|---|
| `WINDOW_BLUR` | INFO | **WARN**, with `metadata.duration_ms` — how long focus was lost |
| `TAB_CHANGED` | WARN | WARN, add `duration_ms` |
| `FULLSCREEN_EXIT` | WARN | **CRITICAL** — exiting fullscreen is deliberate |
| `PASTE_DETECTED` | INFO | **WARN**, with the pasted character count |
| `EXTERNAL_DISPLAY` | — | **CRITICAL** |
| `CAMERA_OFF` / `MIC_OFF` | CRITICAL | unchanged |

The proctoring summary flag thresholds move accordingly: any CRITICAL →
`REVIEW_RECORDING`; more than two WARN → `MINOR_FLAGS`.

### 54.3 — Optional screen share

Add `require_screen_share` to the tech-test config, default off. When on, preflight also
requests `getDisplayMedia({ video: { displaySurface: 'monitor' } })` and **verifies the
returned track's `displaySurface` is `monitor`** — a candidate sharing a single tab or
window is rejected with an explanation. If the share ends mid-session, record
`SCREEN_SHARE_STOPPED` as CRITICAL and block until it resumes.

This is the strongest signal available, because it catches a second window or application
on the same machine — which nothing else here can.

### 54.4 — Be honest in the UI

Under the proctoring table, replace the current line with:

> Browser signals are advisory. They cannot detect a second computer, a phone, or a person
> off-camera. Watch the recording before deciding.

**Do not claim more than this.** Fullscreen cannot be enforced — Esc always works, by
browser design, and no site can override it. We detect and flag; we never prevent.

---

## T-55 · The session UI

The recording screen is functional and looks unfinished.

- **Header bar**: role and assessment name left; a live **● Recording** pill with elapsed
  time and the self-view thumbnail right. The countdown goes amber under 5 minutes and red
  under 1.
- **Question card** centred, `maw={860}`, fixed minimum height so Previous/Submit never
  shift. The bare numbered box currently top-left becomes a proper "Question 1 of 1"
  indicator with a progress bar.
- **Self-view** as a small fixed thumbnail, bottom-right, draggable, never covering the
  answer field.
- **Answer field** is an autosize textarea, `minRows={6}`, with a quiet "Saved" indicator.
- The proctoring banner sits directly under the header, amber, and only appears when there
  is something to say.
- On submit: a full-screen confirmation with upload progress, then a clear "You're done"
  state. The candidate must never be left wondering whether it went through.

---

## Verify

Start a recorded test with a second monitor connected — preflight blocks. Disconnect,
start, then reconnect mid-session — `EXTERNAL_DISPLAY` CRITICAL appears and the summary
reads `REVIEW_RECORDING`. Alt-tab away for ten seconds — `WINDOW_BLUR` WARN with a
duration. Press Esc — `FULLSCREEN_EXIT` CRITICAL. Turn the camera off mid-session — the
session blocks until it returns. Grade the result: a real score with no stale failure
banner beside it.
