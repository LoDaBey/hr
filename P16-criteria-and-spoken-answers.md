# P16 — Per-job threshold, free-text screening, spoken answers

One ticket. Read `ARCHITECTURE.md` and `STACK.md` first — the standing rules apply.
**No MCP. No tests. TypeScript only. SWR for reads. Every colour from `theme.ts`.**
**Do not read Vercel logs. Do not query the database. Do not push to GitHub.**

**n8n is already updated and published.** The workflow now accepts `screening_criteria` in
the `screening.run` payload, and has a new sixth task `recording.grade`. Do not change n8n.

---

## T-58 · Per-job shortlist threshold

`HRSYSTEM_jobs.shortlist_threshold` is stored, shown in the wizard, sent to the AI — and
never compared to anything. The global `auto_shortlist_min_score` decides every job.

- In the screening pipeline, the auto-shortlist cut-off is
  `job.shortlist_threshold ?? settings.auto_shortlist_min_score`. The job wins when set.
- The auto-reject floor stays global (`auto_reject_max_score`) — one bar for "clearly
  unsuitable" across the company is right; the shortlist bar is role-specific.
- The timeline reason must name which was used: *"Score 90 met this job's shortlist
  threshold (60) with confidence 0.95"* vs *"…met the default shortlist threshold (75)…"*.
- In the wizard, label it **"Shortlist at or above"** with helper text: *"Candidates at or
  above this score are shortlisted automatically. Leave blank to use the company default
  from Settings."* Allow it to be cleared back to null.

---

## T-59 · AI filtering becomes free text

Replace the Must-have / Nice-to-have builder with a single description of who the hiring
manager is looking for. HR does not want to assign points to fields; they want to write
what they need.

### 59.1 — The editor

Step 3 keeps the name **AI filtering**. Replace the rule builders with:

- **"Who are you looking for?"** — `Textarea`, `autosize`, `minRows={10}`, required to
  publish. Placeholder shows a real example:

  > *We need a senior full-stack engineer who has actually owned a product end to end, not
  > just worked on tickets. Strong React and Node. Must have shipped something with real
  > users. Experience with AWS matters more than a specific framework. A degree is not
  > important — what they have built is. Comfortable in English on calls with US clients.*

- Helper line beneath: *"Write it as you would explain the role to a colleague. The AI
  weighs candidates against this, in the order of importance you imply."*
- **Keep the four weights and the shortlist threshold.** They still shape the score.
- **Delete** the Must-have and Nice-to-have builders, their Add buttons, and the points
  inputs.

Store it as `HRSYSTEM_jobs.screening_criteria text`. Migration, folded into `schema.sql`.

### 59.2 — What must NOT be deleted

**The demographic hard rules stay.** Age min/max and military status are generated from the
toggles on **step 2 (Application form)**, not from the rule builder, and they are the only
**deterministic** gate in the system. Keep writing them to `hard_requirements`, keep
evaluating them in TypeScript, keep auto-reject wired to them alone.

This matters more than it looks. Auto-reject must never fire on an AI score or on free
text — only on a rule that is arithmetic and auditable. If a rejected candidate ever asks
why, the answer has to be "you were under the stated minimum age", never "the model read
your CV and disagreed". Free text drives **scoring and shortlisting**; it must never drive
rejection.

### 59.3 — Send it to n8n

`screening.run` payload gains `screening_criteria: job.screening_criteria ?? null`.
The n8n prompt already reads it and treats it as the primary instruction. Nothing else in
the payload changes.

### 59.4 — Existing jobs

Migrate any job that has `hard_requirements` or `soft_requirements` from the old builder
into readable prose in `screening_criteria` — one line per rule, e.g.
`Years of experience: at least 5` → *"At least 5 years of experience."* Do it in the
migration so no live job loses its criteria. Leave the columns in place; stop writing to
them from the editor.

---

## T-60 · Recorded test: rules, and answering to camera

### 60.1 — Rules are derived, not typed

**Instructions** and **Rules** currently overlap and confuse. Fix the split:

- **Instructions** stays free text — what the candidate should do, in HR's words.
- **Rules** becomes **read-only and generated from the four Require toggles**:

| Toggle | Generated rule |
|---|---|
| Require camera | Your camera must stay on for the whole session |
| Require microphone | Your microphone must stay on for the whole session |
| Require fullscreen | Stay in fullscreen — leaving it is recorded |
| Require screen share | Share your entire screen, not a single tab or window |

Plus two always shown: *"This session is recorded"* and *"Do not switch tabs or use another
application"*.

Render as a disabled bulleted list that updates live as toggles change, with the caption
*"Shown to the candidate before they start. These follow your settings above."* Unchecking
a toggle removes its line. Keep the `rules` column; write the generated text to it on save
so the candidate page needs no change.

### 60.2 — Spoken answers

Add `answer_mode` to assessment questions: `'written' | 'spoken'`, default `'written'`.
Migration, folded into `schema.sql`.

**In the editor** (`TECH_TEST` only): a segmented control per question — **Written answer**
/ **Spoken answer**. Helper: *"Spoken answers are transcribed from the recording and graded
the same way. No typing."*

**On the candidate page**, for a `spoken` question:
- No textarea. Show the question large, with a clear prompt: *"Answer out loud. Your
  recording is capturing this."*
- A visible per-question speaking indicator so they know it is being captured.
- **Next** is always enabled for spoken questions — there is nothing to validate. Record
  which question was on screen and when, so the transcript can be mapped back.
- The left rail shows spoken questions as "Answered aloud" once passed, never
  "Not answered".

**Persist the timing.** Store `{question_id, shown_at, left_at}` per spoken question on the
sitting. The grader uses order and content to map the transcript, and these timings make
that far more reliable.

### 60.3 — Grade the recording

New automation task, **already built and published in n8n**:

```
POST /webhook/hr-automation
{ "task": "recording.grade",
  "payload": {
    "audio_url": "<Cloudinary audio derivation of the recording>",
    "questions": [{ question_id, prompt, rubric, max_score, shown_at, left_at }]
  } }

→ { ok: true, data: { transcript: "...", results: [ { question_id, score, max_score,
     correct_concepts, missing_concepts, technical_errors, feedback, confidence } ] } }
```

**Send audio, not video.** Cloudinary can derive an audio-only file from the stored
recording — request the `.mp3` derivation of the video public_id. A 20-minute video at the
current bitrate is far over the transcription size limit; the audio derivation is a
fraction of it. Build that URL in `cloudinary.ts` as `recordingAudioUrl(publicId)`.

In `evaluateTechTest`:
- If any question is `spoken` **and** `recording_status = 'READY'` → call
  `recording.grade` with the spoken questions, and `assessment.grade` with the written ones
  if there are any. Merge both result sets before writing evaluations.
- If all questions are written → unchanged.
- If a spoken question exists but the recording never uploaded → do **not** score it 0.
  Write an error row and set the sitting to needs-review with the reason *"Spoken answers
  could not be graded — recording unavailable"*. Never reject someone for our upload
  failing.

Set the task timeout for `recording.grade` to **90s** in `TASK_TIMEOUT_MS` — transcription
plus grading is slower than grading alone — and confirm `maxDuration = 60` on the route
that calls it. If the two cannot fit, move `recording.grade` to the pipeline sweep rather
than the submit request.

**Store the transcript** on the sitting and show it in `TechTestReview` beneath the video,
with each question's segment beside its evaluation. A reviewer should be able to read what
was said without scrubbing the recording.

---

## Verify

Create a job with a free-text description and a shortlist threshold of 60. A candidate
scoring 65 must auto-shortlist on that job while the company default is 75. Configure a
recorded test with one written and one spoken question, take it, and confirm both are
graded, the transcript appears in the review, and the rules the candidate saw match the
toggles exactly.
