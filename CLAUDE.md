# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered ticket management system: receives support emails, uses an LLM to classify/summarize/polish replies, and gives agents a dashboard to manage tickets. See `project-scope.md` (scope), `tech-stack.md` (intended stack), and `implementation-plan.md` (phased build-out). Implemented so far: project scaffolding, authentication (Better Auth email/password, `admin`/`agent` roles), admin user management (CRUD over `/users`), inbound email ingestion, the agent-facing ticket UI (list + detail), and the first AI features — automatic ticket classification (on inbound, off the request path via a pg-boss job queue), on-demand thread summaries, and AI polish for draft replies (see AI (server) and Background jobs). The AI runs on **OpenAI `gpt-5-nano` via the Vercel AI SDK** (`server/src/lib/ai.ts`), which differs from the Claude API named in the planning docs — treat this file as the source of truth for what's implemented. Still unbuilt from Phase 6: the knowledge base and AI-suggested reply drafts (persisted as `ai_draft`).

## Commands

All commands run from the repo root using Bun workspaces (`client`, `server`).

- `bun dev` — run client (Vite) and server (Express) together via `concurrently`
- `bun dev:client` / `bun dev:server` — run one side only
- `bun build` — build both workspaces
- `bun --filter client lint` — lint the client with oxlint (server has no lint script yet)
- `bun --filter client test` — client component tests (see Testing); **never bare `bun test`** (that runs Bun's own runner, which lacks `vi.mocked` and fails)
- `bun test:e2e` — Playwright E2E (see Testing)

`bun --filter server build` currently fails with `error TS2688: Cannot find type definition file for 'bun-types'` — pre-existing, unrelated to Prisma; `bun --watch` (dev) is unaffected since it doesn't type-check.

Ports: client `5173`, API `3001`. Vite proxies `/api/*` → `http://localhost:3001` (`client/vite.config.ts`), so call the API with same-origin relative paths (`fetch('/api/health')`), not an absolute URL.

## Architecture

Bun workspace monorepo, three packages:

- `server/` — Express 5 + TypeScript, run with `bun --watch` in dev (no local build; `tsc` only for the production `build`/`start`). Entry `server/src/index.ts`.
- `client/` — React 19 + TypeScript (Vite), Tailwind CSS v4 (via `@tailwindcss/vite`, imported in `client/src/index.css` with `@import "tailwindcss"`).
- `core/` — framework-agnostic code shared by both (see Shared code).

`client`/`server` are independently deployable but developed together; the root `package.json` is orchestration only.

## Shared code (`core` package)

`core/` holds anything that must stay identical on client and server: shared Zod schemas (server request + client form validation), domain enums/constants, and their types. Import as the bare package name (`import { createUserSchema, ROLE, type Role } from "core"`), always from the barrel — never an internal path like `"core/user.schema"`. Both packages depend on it via `"core": "workspace:*"`.

- **Single source of truth — reference `core` constants, never re-type their string values.** For any domain enum/constant in `core` (`ROLE`/`Role`, `TICKET_STATUS`/`TICKET_CATEGORY`/`TICKET_MESSAGE_TYPE`, `TICKET_SORT_FIELD`, and their types), import and use the constant — including as **computed `Record`/object keys** (`{ [TICKET_STATUS.open]: 'Open' }`, `user.role === ROLE.admin`). This holds even where a literal would typecheck (`Record<TicketStatus, T>` checks keys but still *duplicates* the values). Import just the `type` when you only need the type; import the value constant whenever you name a member. Reference pattern: the label/variant maps in `client/src/lib/ticketMeta.ts`. (Test fixture/mock string literals are the pragmatic exception.) These enums mirror the Prisma enums in `server/prisma/schema.prisma` — keep them in sync.
- **File layout: types vs schemas.** Dependency-free types/constants live in `<domain>.ts`; Zod schemas (which import `zod`) in `<domain>.schema.ts`; `index.ts` is a pure barrel re-exporting both. Current files: `role.ts`, `ticket.ts` (status/category/message-type + sort-field enums, subject/body max-length constants), `user.schema.ts` (`create`/`updateUserSchema`), `ticket.schema.ts` (`inboundEmailSchema`, `ticketListQuerySchema`, `TICKET_PAGE_SIZE`, `updateTicketSchema`, `createReplySchema`, `polishReplySchema`). Keep both kinds for one domain colocated across the two files.
- Ships **TypeScript source directly, no build step** — `exports` points `.` at `src/index.ts`, which works because both consumers use `moduleResolution: "bundler"`. Adding an export needs no generate/build — just import it.
- Keep it **framework-agnostic and dependency-light**: schemas, types, constants only. No React/Express/Prisma; `zod` is its one dependency.
- A new workspace dependency (new package or `workspace:*` link) requires `bun install` from the repo root.

## UI components (client)

shadcn/ui via `bunx shadcn@latest init -d` — the `base-nova` preset, built on `@base-ui/react` primitives (**not Radix** — don't assume Radix APIs in `client/src/components/ui/*`).

- Config: `client/components.json` (base color `neutral`, CSS variables, `lucide-react` icons).
- Path alias `@/*` → `client/src/*`, wired in `tsconfig.app.json` (`paths`, no `baseUrl`) and `client/vite.config.ts`.
- Forms use `field.tsx` (`Field`, `FieldLabel`, `FieldError`, `FieldGroup`…), not `form.tsx`/`FormField` (absent in this preset). `FieldError` takes RHF errors via `errors={[errors.foo]}`. Pattern: `client/src/pages/LoginPage.tsx`.
- `Button` is base-ui (no `asChild`/Slot) — to render a link as a button, apply `buttonVariants({...})` to a `<Link>` (see `TicketDetailPage.tsx`).
- Theme (light/dark CSS vars + Chrome autofill override) lives in `client/src/index.css`. Font: Geist Variable via `@fontsource-variable/geist`.
- Add components with `cd client && bunx shadcn@latest add <name>`; names differ from classic shadcn (e.g. `form` → `field`) — check with `bunx shadcn@latest search @shadcn --query <term>`.

## Data fetching (client)

Use **axios** + **TanStack Query** (`@tanstack/react-query`) for new code, not raw `fetch`/`useEffect`.

- `QueryClient`/`QueryClientProvider` are set at the app root (`client/src/main.tsx`).
- Fetch with `useQuery({ queryKey, queryFn })` where `queryFn` uses `axios.get<T>('/api/...')` returning `res.data`; render off `isPending`/`isError`/`data`. Patterns: `UsersPage.tsx`, `TicketsPage.tsx` (server-side sort/filter/pagination + `keepPreviousData`), `TicketDetailPage.tsx`.
- Same-origin relative paths (`/api/...`) so the Vite proxy handles it. Axios rejects on non-2xx, so no `res.ok` check. Read server errors via `getServerErrorMessage(error, fallback)` (`client/src/lib/http.ts`).
- Install client deps from **inside `client/`** (`cd client && bun add <pkg>`); root `bun add --filter client` fails with a Bun `DependencyLoop` here.

## Database

Prisma 7 + PostgreSQL, scoped to `server/`:

- `server/prisma/schema.prisma` — datasource + generator; the Better Auth models (`User`/`Session`/`Account`/`Verification`) and the ticket domain (`Ticket`/`TicketMessage`, see Tickets). All `@@map`-ed to lowercase table names.
- `server/prisma.config.ts` — Prisma CLI config; reads `DATABASE_URL` from `server/.env` via `dotenv/config`. Prisma 7 keeps the datasource `url` here, not in `schema.prisma` (intentional).
- `server/src/lib/prisma.ts` — shared `PrismaClient` singleton using the `@prisma/adapter-pg` driver adapter (Prisma 7 has no bundled query engine).
- Generated client: `server/src/generated/prisma` (gitignored, under `src/` to satisfy `rootDir`). After a schema change: `bun x prisma generate`; migrate with `bun x prisma migrate dev --name <name>` (both from `server/`).
- `server/.env` holds `DATABASE_URL` (gitignored). `/api/health` runs `SELECT 1` through Prisma — doubles as a DB connectivity check.

## Authentication

Better Auth, email/password only, self-serve sign-up disabled — users come from the seed script or an admin via `POST /api/users` (no public sign-up).

- `server/src/lib/auth.ts` — `betterAuth()` instance, `emailAndPassword: { enabled: true, disableSignUp: true }`. `trustedOrigins` defaults to `http://localhost:5173` via `CLIENT_ORIGIN`. Adds a required `role` field (`admin`|`agent`) via `user.additionalFields` with `input: false` (settable only via Prisma, e.g. the seed).
- `server/src/lib/authorize.ts` — server-side authz middleware: `requireRole(...roles)` re-derives the session from cookies via `auth.api.getSession` (never trusts a client role), `401` unauthenticated / `403` wrong role, attaches `req.session`. `requireAuth` = `requireRole()` (any authenticated user).
- `server/src/index.ts` — mounts auth at `app.all("/api/auth/*splat", toNodeHandler(auth))` **before** `express.json()` (Better Auth parses its own body). `*splat` is Express 5 / path-to-regexp v8 wildcard syntax. Domain routers: `usersRouter` (`/api/users`), `inboundEmailRouter` (`/api/inbound-email`), `ticketsRouter` (`/api/tickets`), `agentsRouter` (`/api/agents`, admin-only picker of assignable active agents). After `app.listen` it calls `startQueue()` to boot the pg-boss worker (see Background jobs), non-fatally.
- User endpoints (`server/src/routes/users.ts`, all `requireRole(ROLE.admin)`): `GET`/`POST /api/users`, `PATCH`/`DELETE /api/users/:id`. `DELETE` is a **soft delete** (sets `deletedAt`, revokes sessions, refuses `admin` with `403`); `GET` filters `deletedAt: null`.
- Data model: `User`/`Session`/`Account`/`Verification` match Better Auth's shape; `Account` holds the hashed password for the `credential` provider.
- `server/prisma/seed.ts` (`bun run seed` from `server/`) — seeds via a `seedUser({ name, email, password, role })` helper (hashes with `hashPassword` from `better-auth/crypto`, creates a `User` + `credential` `Account`, no-op if the email exists). Always seeds an admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`; also an agent when `AGENT_EMAIL`/`AGENT_PASSWORD` are set.
- Required `server/.env`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`; `OPENAI_API_KEY` is required for the AI features (classification/summary/polish throw without it — the queue worker retries then gives up, and the two AI endpoints return `502`); optional `AGENT_EMAIL`/`AGENT_PASSWORD`, `CLIENT_ORIGIN`, `INBOUND_EMAIL_SECRET` (all gitignored).
- `client/src/lib/auth-client.ts` — `createAuthClient()` (no `baseURL`, same-origin via proxy), `inferAdditionalFields<typeof auth>()` so `session.user.role` is typed. Exports `useSession`, `signIn`, `signOut`. Role constants come from `"core"`, not here.
- `client/src/App.tsx` — `react-router` (`BrowserRouter`). `ProtectedRoute` redirects to `/login` when unauthenticated and to `/` when an optional `role` prop mismatches. Routes: `/` (`HomePage`), `/login`, `/tickets` (`TicketsPage`), `/tickets/:id` (`TicketDetailPage`), `/users` (`UsersPage`, admin-only), `*` → `/`. Client-side guarding only; the API is separately enforced by `requireRole`. `NavBar` shows Tickets (all authed) and Users (admin only), reads `session.user.name`, calls `signOut()`.

## Tickets

The ticket domain — inbound-email ingestion (Phase 5) plus the agent-facing UI (Phase 4).

**Data model** (`server/prisma/schema.prisma`): `Ticket` (`subject`, `requesterEmail`, `status`/`category` enums, optional `assignee` → `User` via `assigneeId` with `onDelete: SetNull`, timestamps, `messages`) and `TicketMessage` (`type`, `fromEmail`, `body`, `messageId`, `inReplyTo`). `TicketMessage.messageId` is a nullable `@unique` column storing the email `Message-ID` (powers dedupe + threading). The status/category/message-type Prisma enums mirror `core/src/ticket.ts` — import those constants, don't hardcode. New tickets default to `status: open`, `category: general` — a pg-boss job then reclassifies the category asynchronously (see AI (server) / Background jobs). Messages are `TICKET_MESSAGE_TYPE.inbound` (email ingestion) or `agent_reply` (an agent's reply from the detail page); `ai_draft` isn't produced yet.

**Endpoints** (`server/src/routes/tickets.ts`, `requireAuth`):
- `GET /api/tickets` — paginated list (summary fields + message `_count`). Query params validated by `ticketListQuerySchema`: `sort`/`order` (server-side ordering; `messages` sorts on the relation `_count`), optional `status`/`category`/`q` filters (`q` matches subject OR requester email, case-insensitive, AND-ed), `page`/`pageSize`. Responds `{ tickets, total, page, pageSize }`.
- `GET /api/tickets/:id` — one ticket with its full message thread (oldest-first) and `assignee` (`{ id, name, email }` or `null`); `404 { error }` if unknown.
- `PATCH /api/tickets/:id` — update triage fields, validated by `updateTicketSchema`. Any agent may change `status`/`category`; `assigneeId` (assign/unassign) is admin-only and a non-null id must be an active agent. Responds with the updated ticket in the `GET /:id` shape.
- `POST /api/tickets/:id/messages` — post an agent reply, validated by `createReplySchema` (`{ body }`). Sender is the signed-in agent (from the session, never the body), typed `agent_reply`. Creates the message and bumps the ticket's `updatedAt` in one transaction; responds `201` with the updated ticket in the `GET /:id` shape (`404` if unknown).
- `POST /api/tickets/:id/polish-reply` — AI-polish an agent's draft reply, validated by `polishReplySchema` (`{ body }`). Returns `{ text }` (an improved draft, greeting the requester by first name and signing off with the agent's name); **nothing is persisted** — the composer swaps its textarea for the result. `404` unknown, `502` on AI failure.
- `POST /api/tickets/:id/summarize` — AI summary of the ticket + full thread. No request body; returns `{ summary }`; **nothing is persisted** (regenerated on demand each click). `404` unknown, `502` on AI failure.

**Inbound webhook** — `POST /api/inbound-email` (`server/src/routes/inbound-email.ts`): provider-agnostic JSON validated by `inboundEmailSchema` (`{ from, subject, text, messageId?, inReplyTo?, references? }`). **Deduped** by `messageId` (retries → `200 { deduped: true }`); **thread-matched** on `inReplyTo`/`references` against `TicketMessage.messageId` (append + reopen if resolved/closed), else create (`201 { created: true }`). On a **create**, it `await`s `enqueueClassifyTicket(...)` (a fast, durable pg-boss insert) before responding, so classification runs off the request path (see Background jobs) — reply-appends keep their existing category. Public (mail providers carry no session cookie) — guarded by `verifyWebhookSecret` (`server/src/lib/webhookAuth.ts`), a constant-time compare of the `X-Webhook-Secret` header vs `INBOUND_EMAIL_SECRET` (`401` on mismatch). try/catch → `500 { error }`.

**Client UI**:
- `client/src/pages/TicketsPage.tsx` — list built on TanStack Table: server-side sort via column headers, status/category `FilterSelect`s, debounced search, and pagination. Each subject links to its detail page.
- `client/src/pages/TicketDetailPage.tsx` — a plain header block (subject, status/category badges, Requester / Assigned To / Opened) distinct from the message thread below, rendered as `TicketMessageCard`s, with a `TicketReplyForm` composer at the bottom that POSTs a reply and drops the updated ticket into the detail cache. Between header and thread, `TicketSummary` offers an on-demand AI summary (POST `/summarize`, re-runs each click, nothing cached); `TicketReplyForm` also has an AI **Polish** button (POST `/polish-reply`, swaps the draft with the result).
- `client/src/lib/ticketMeta.ts` — shared label + Badge-variant maps for status/category/message-type (the single-source-of-truth reference pattern). `client/src/lib/format.ts` — `formatDate` / `formatDateTime` (shared `Intl` instances).

## AI (server)

LLM features live in `server/src/lib/ai.ts`, on **OpenAI `gpt-5-nano` via the Vercel AI SDK** (`ai` + `@ai-sdk/openai`, both `server` deps). Note this is the *implemented* provider; the planning docs (`tech-stack.md`, `implementation-plan.md`) still name the Claude API as the original intent.

- Three exported functions, all guarding on `OPENAI_API_KEY` (throw a clean error if unset, so callers surface `502` or the queue worker retries then gives up):
  - `polishReply(draft, { agentName, customerFirstName })` → improved reply text (draft-only; greets by first name, signs off with the agent). Used by `POST /api/tickets/:id/polish-reply`.
  - `summarizeTicket(subject, messages)` → a short plain-text brief over the whole thread. Used by `POST /api/tickets/:id/summarize`.
  - `classifyTicket(subject, body)` → a `TicketCategory`, constrained to the valid set via the SDK's `Output.choice({ options: [...TICKET_CATEGORIES] })` (guaranteed-valid output, no free-text parsing). Run by the pg-boss classify worker, never inline in a request.
- **Reference the `core` category constants** (`TICKET_CATEGORIES`/`TICKET_CATEGORY`) — don't hardcode category strings (single-source-of-truth rule).
- The route helper `firstNameFromEmail` (`server/src/routes/tickets.ts`) derives the greeting name from the requester email (the ticket stores no requester name).
- **AI SDK v7 APIs differ from v3/v4** — pull docs via Context7 (`ai` package). E.g. classification uses `generateText` + `Output.choice`, **not** the old `generateObject({ output: 'enum' })`; the handler/output shapes changed across majors.

## Background jobs (pg-boss)

`server/src/lib/queue.ts` runs a **pg-boss** job queue (`pg-boss`, a `server` dep) on the same Postgres via `DATABASE_URL`. pg-boss creates and owns its **own `pgboss` schema** on `start()` — it is **not** a Prisma model and needs no Prisma migration (it sits beside the app tables). One `boss` instance per process.

- `startQueue()` — called once from `server/src/index.ts` after `app.listen` (non-fatal: if it can't start, the API still serves and tickets keep their default category). It runs `boss.start()`, `boss.createQueue('ticket-classify', { retryLimit: 3, retryBackoff: true })`, and registers the worker.
- The worker handler receives a **batch array** of jobs (`Job<T>[]`) — iterate it; per job it calls `classifyTicket` and persists `ticket.category`. A throw fails the job and lets pg-boss retry per the queue's `retryLimit`.
- `enqueueClassifyTicket({ ticketId, subject, body })` — a fast, durable insert; the inbound webhook awaits it, then responds. So classification runs **out of band**, survives a server restart, and is retried — none of which the previous in-process fire-and-forget could do.
- pg-boss v12 uses a **named export** (`import { PgBoss } from "pg-boss"`); retry options live on the queue / `send` options (`QueueOptions`), and `createQueue`'s options omit `name`. The API shifted across majors — pull docs via Context7 (`/timgit/pg-boss`) before changing queue code.

## Validation (server)

Server request-body validation uses **Zod** (v4, a `server` dependency) — validate untrusted input with a schema, not hand-rolled checks. Reference: `POST /api/users`.

- Validate via the `parseBody(schema, source, res)` helper (`server/src/lib/validate.ts`): on failure it sends `400 { error: <first issue message> }` and returns `null` (caller `return`s early); on success returns typed data. `ticketsRouter` uses the same helper for `req.query`.
- The `{ error: "<message>" }` single-string shape is the client contract (read via `getServerErrorMessage`) — keep it; don't return Zod's raw `flatten()`/`issues`.
- Zod 4 APIs: top-level formats like `z.email(msg)` (not `z.string().email()`), `.trim()` before format checks (`z.string().trim().pipe(z.email(msg))`), a custom message per validator. Schemas shared with the client live in `core` (see Shared code).

## Testing (component)

Client component/unit tests: **Vitest + React Testing Library**, colocated as `client/src/**/*.test.tsx`. References: `UsersPage.test.tsx` (query states), the dialog specs (form/mutation flows), `TicketsPage.test.tsx` / `TicketDetailPage.test.tsx`. For test-quality principles use the `writing-good-tests` skill; this covers repo mechanics only.

- Run with `bun --filter client test` (or `bun run test` from `client/`); **never bare `bun test`** (see Commands).
- Config: the `test` block in `client/vite.config.ts` — `environment: 'happy-dom'` (**not jsdom** — jsdom's `undici` throws `markAsUncloneable is not a function` under Bun), `globals: true`, `setupFiles: './src/test/setup.ts'` (loads jest-dom matchers, RTL `cleanup()` after each test).
- Render helpers (`client/src/test/render.tsx`): `renderWithQueryClient(ui)` wraps a fresh `QueryClientProvider` (`retryDelay: 0` so a component's `retry` reaches the error state fast); `renderWithProviders(ui, { initialEntries })` also wraps `MemoryRouter` for components using `<Link>`/router hooks (`useParams`, etc.).
- Mock network via `vi.mock('axios', () => ({ default: { get: vi.fn() } }))`; add the verb you call plus `isAxiosError` (e.g. `{ default: { get: vi.fn(), isAxiosError: vi.fn() } }`) to exercise the server-error / 404 branches.

## Testing (E2E)

Playwright at the repo root, against a **separate test database** so runs never touch dev data.

**Reach for E2E only when a behavior needs the real client + server + DB together** — auth/session round-trips, server-enforced authz/redirects, real persistence across a reload. It's the slowest layer; keep it thin. **Push everything provable client-side down into a component test** (form/Zod validation, role-based rendering, query loading/empty/error, anything drivable with a mocked axios / `auth-client` boundary). Rule of thumb: mocked boundary → component test; "the live server did X" → E2E. Reference split: `LoginPage.test.tsx` / `NavBar.test.tsx` (client) vs `e2e/auth.spec.ts` (real sign-in/redirect). Don't cover the same behavior at both layers.

**Always write/update E2E specs through the `e2e-test-writer` subagent** (Agent tool, `subagent_type: "e2e-test-writer"`) — it owns the locator/seed/parallel-safe conventions and harness wiring. Key facts:
- Config `playwright.config.ts` (root); specs in `e2e/`; `baseURL` `http://localhost:5173`.
- Boots the real client + server against the test DB; `reuseExistingServer: false`, so **stop `bun dev` before running E2E** or ports collide.
- `server/.env.test` (gitignored; template `server/.env.test.example`) holds the test `DATABASE_URL` + seed credentials; `e2e/global-setup.ts` migrates/seeds it once.
- Commands (root): `bun test:e2e`, `bun test:e2e:ui`, `bun test:e2e:report`. First time: `bunx playwright install chromium`.

## Fetching library documentation (Context7 MCP)

Use Context7 MCP to pull current docs for any library here (React 19, Express 5, Vite, Tailwind v4, Bun, Better Auth, Prisma 7…) rather than training data — the stack pins majors whose APIs differ from older assumptions.

**Workflow (two steps):** (1) `mcp__context7__resolve-library-id` — library name → Context7 ID (skip only if given an ID in `/org/project` form); (2) `mcp__context7__query-docs` — that `libraryId` + a specific, single-concept `query`, one call per concept.

**Setup:** registered as an MCP server (not a package dep). Manage via CLI: `claude mcp list` / `claude mcp get context7`; add with `claude mcp add --transport http context7 https://mcp.context7.com/mcp --scope project --header "CONTEXT7_API_KEY: <key>"` (or stdio `claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp`). `/mcp` shows connection state / re-auth in-session.

**If a call fails** (`TypeError: fetch failed` — blocked outbound HTTPS, or a missing/expired `CONTEXT7_API_KEY`): say so explicitly, then proceed on best knowledge and lean on empirical verification (typecheck, a real runtime/`curl` check). Don't present unavailable docs as if consulted.
