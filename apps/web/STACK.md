# Stack — libraries, not hand-rolled code

**Authoritative.** Where a ticket says "build X yourself", this file wins. Attach it to
every Cursor session.

## Rule

If a maintained library covers it, use the library. Hand-write only what is specific to
this system: the proxy, the action router, the state machine, the SQL, the AI prompts.

## Next.js app (`apps/web`)

| Need | Library | Instead of |
|---|---|---|
| Framework, routing, server | **Next.js 15+ App Router, TypeScript** | Vite + react-router |
| UI components | `@mantine/core` | hand-built Table / Badge / Field / Modal |
| Hooks | `@mantine/hooks` | hand-written proctoring listeners — see below |
| Forms + validation | `@mantine/form` + `zod` | `useState` per field, manual error maps |
| Dates, times, timezones | `@mantine/dates` + `dayjs` | hand-rolled formatting and scheduling |
| Toasts | `@mantine/notifications` | ad-hoc banners |
| Server state / GET | `swr` | `@tanstack/react-query`, manual loading/error state |
| Tables | `mantine-datatable` | hand-built sorting + pagination |
| Icons | `@tabler/icons-react` | inline SVG |
| Code answers | `@uiw/react-codemirror` + lang-javascript / lang-sql | monospace textarea |
| Interview recording | `recordrtc` | raw MediaRecorder + browser format branching |
| Auth + session | `next-auth@beta` (Auth.js v5), Credentials provider | hand-rolled `jose` session, `/api/auth/*` routes |

No Tailwind — Mantine handles layout (`Stack`, `Group`, `Grid`, `Card`).
No `react-router-dom` — Next's file routing replaces it.
`pg` **is** used — Next.js owns the database directly. See `ARCHITECTURE.md`.

Swap TanStack Query out:
```powershell
npm uninstall @tanstack/react-query
npm install swr
```
`SWRConfig` replaces `QueryClientProvider` in `providers.tsx`. Reads are
`useSWR('/api/...', fetcher)`; writes are plain `fetch` followed by `mutate(key)`.

**`@mantine/hooks` covers the proctoring signals directly:** `useFullscreen`,
`useDocumentVisibility`, `useNetwork`, `useIdle`, `useWindowEvent`. Wire the event queue to
these rather than adding `document.addEventListener` by hand.

## Next.js specifics

- Server Components by default. Add `'use client'` only where you need state, effects or
  browser APIs. Every page using react-query, Mantine forms, CodeMirror or recordrtc is a
  client component.
- `lib/n8n.ts` starts with `import 'server-only'`.
- Route handlers are `export async function POST(req: Request)` in `app/api/**/route.ts`.
- Auth is NextAuth v5: config in `src/auth.ts`, catch-all at
  `app/api/auth/[...nextauth]/route.ts`, `session.strategy: 'jwt'` (mandatory with
  Credentials), `maxAge` equal to the n8n JWT's 12h.
- `middleware.ts` is `export { auth as middleware } from '@/auth'` with a `/hr/:path*`
  matcher. It proves a session exists, nothing more. Real authorisation happens in n8n on
  every call.

## n8n — use nodes, not Code nodes

| Need | Use | Instead of |
|---|---|---|
| Sign / verify HR JWT | **JWT node** + JWT Auth credential | hand-rolled HMAC in a Code node |
| Verify HR password | Postgres `crypt($2, password_hash)` — pgcrypto is enabled | `bcryptjs` + `NODE_FUNCTION_ALLOW_EXTERNAL` |
| Assessment tokens | **Crypto node** — generate, then SHA-256 | `require('crypto')` in a Code node |
| AI returning JSON | **Basic LLM Chain + Structured Output Parser** | HTTP Request + manual JSON repair |
| CV text extraction | **Extract From File** | anything else |

## Still hand-written on purpose

- Cloudinary signing — n8n has no Cloudinary node, and it is four lines of SHA-1.
- The RPC proxy, action router, response envelope, state machine, idempotency and
  rate-limit tables. This is the application itself.

## Not in this project

- No test framework, no test files, no `test` script.
- No MCP servers or connectors.
- No Tailwind, no shadcn, no charts library, no ORM.

## Standing rules for every ticket

- **Never read Vercel logs or query the database to diagnose.** If something fails
  silently, the fix is to make the app record the failure where it can be seen — a
  `HRSYSTEM_workflow_errors` row and an honest state in the UI. Diagnosis that depends on
  a log nobody can reach is not a fix.
- **Never push to GitHub.** Commit locally when a ticket asks for it. Pushing is Khaled's
  decision, always.
- **Never leave a silent failure.** Every early return, caught error and skipped automation
  writes an error row and surfaces something truthful on screen. "Awaiting", "failed" and a
  genuine zero must never look the same.
