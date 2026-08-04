# Implementation Plan

Based on `project-scope.md` and `tech-stack.md`. Original planned stack: React + TS + Tailwind + React Router (frontend), Node/Express + TS with database-backed sessions (backend), PostgreSQL + Prisma, Claude API, SendGrid/Mailgun, Docker.

> **As built:** the checkboxes and inline _italic notes_ below track what actually shipped. Key deviations: **Bun** runtime + workspaces monorepo (with a shared `core` package); **Better Auth** for auth; **OpenAI `gpt-5-nano` via the Vercel AI SDK** instead of the Claude API; **pg-boss** for background jobs; **Sentry** for error monitoring. Outbound email, a `KnowledgeBaseArticle` model, and Docker/deploy are not built yet. `CLAUDE.md` is the source of truth for the current implementation.

## Phase 1 — Project Setup & Foundations

- [x] Scaffold repo structure — _Bun **workspaces monorepo**: `client/` (React + Vite + TS), `server/` (Express + TS), and a shared `core/` package_
- [x] Configure lint/tsconfig for both packages — _**oxlint** on the client (no Prettier/ESLint)_
- [x] Set up Tailwind CSS in `client/` — _Tailwind v4 via `@tailwindcss/vite`_
- [x] Set up React Router with a basic route shell
- [x] Set up Prisma in `server/`, connect to PostgreSQL — _Prisma 7 with the `@prisma/adapter-pg` driver adapter_
- [ ] Add Docker Compose for local Postgres — _not built; bring your own local Postgres_
- [x] Add `.env` handling for DB URL, auth secret, LLM API key, webhook secret — _uses `OPENAI_API_KEY`, not a Claude key_
- [x] Basic Express app skeleton: health check route, error-handling middleware — _`GET /api/health` (runs `SELECT 1`) + the Sentry Express error handler; no request-logging middleware yet_

## Phase 2 — Data Model

- [x] Design Prisma schema: `User`/`Session`/`Account`/`Verification` (Better Auth), `Ticket`, `TicketMessage` — _no `KnowledgeBaseArticle` model: the KB is a static markdown file (`server/knowledge-base.md`)_
- [x] Run initial migration
- [x] Seed script: create default admin user — _also an optional agent (`seedUser` helper)_

## Phase 3 — Authentication & User Management

> **Status / deviation:** built on **Better Auth** (email/password, self-serve sign-up disabled) rather than a hand-rolled `express-session` + bcrypt setup. Sessions are Postgres-backed via Prisma; password hashing and session management come from Better Auth.

- [x] Backend: session store backed by Postgres — _Better Auth `Session`/`Account` models via Prisma_
- [x] Backend: login/logout with password hashing — _Better Auth email/password (`credential` provider)_
- [x] Backend: auth middleware + role guard (admin-only vs agent routes) — _`requireRole`/`requireAuth` (`server/src/lib/authorize.ts`)_
- [x] Backend: admin endpoints to create/list/deactivate agents — _`/api/users` CRUD; delete is a **soft delete**_
- [x] Frontend: login page
- [x] Frontend: session-aware route protection (redirect unauthenticated users)
- [x] Frontend: admin user-management page (list agents, create-agent form)

## Phase 4 — Core Ticket Management

- [x] Backend: list tickets endpoint with filtering (status, category, assignee) and sorting
- [x] Backend: ticket detail endpoint (ticket + message thread)
- [x] Backend: update ticket status/category endpoint
- [x] Backend: add manual reply/message to a ticket
- [x] Frontend: ticket list page with filter/sort controls
- [x] Frontend: ticket detail page with thread view and status/category controls
- [x] Frontend: manual reply form

## Phase 5 — Email Ingestion & Outbound

- [x] Configure inbound email webhook endpoint — _provider-agnostic JSON at `POST /api/inbound-email`, guarded by a shared-secret header; not wired to a specific provider's parse format yet_
- [x] Parse inbound payload → create new ticket, or append to existing ticket by matching thread headers (`References`/`In-Reply-To`) — _also deduped by `Message-ID`_
- [ ] Backend: outbound email service (send agent/AI replies via SendGrid/Mailgun API) — _not built: replies are stored on the ticket, not emailed out_
- [x] Error handling + logging for webhook failures (malformed payloads, provider errors) — _Zod validation + try/catch; errors reported to Sentry (see Phase 8)_

## Phase 6 — AI Features

> **Status / deviation:** the AI service is built on **OpenAI `gpt-5-nano` via the Vercel AI SDK** (`server/src/lib/ai.ts`), not the Claude API originally planned. Classification, KB auto-resolution, summaries, and reply polish ship. The knowledge base is a static markdown file (`server/knowledge-base.md`) fed whole into the triage prompt — there's no admin CRUD or Postgres full-text retrieval yet, and the AI answers auto-resolved tickets directly rather than suggesting a draft for an agent to send.

- [x] Backend: LLM client wrapper + prompt templates (`server/src/lib/ai.ts`) — _uses OpenAI via the Vercel AI SDK instead of the Claude API_
- [x] AI ticket classification: auto-assign category on ticket creation, editable by agent — _runs off the request path via a **pg-boss** job queue (`server/src/lib/queue.ts`) so the inbound webhook stays fast_
- [x] AI knowledge-base auto-resolution: on inbound, the triage step tries to fully answer the ticket from `server/knowledge-base.md` — _if it can (and no escalation rule applies), it records an `ai_reply` and marks the ticket `ai_resolved` (hidden from the default list); otherwise it hands the ticket to a human (`open`). Status lifecycle: `new → processing → ai_resolved | open`._
- [x] AI summary: generate a thread summary, shown on ticket detail — _generated on demand (re-run each click); **not** stored in the DB_
- [x] AI reply polish: rewrite an agent's draft reply for clarity/tone (added beyond the original plan; not persisted)
- [ ] Knowledge base: admin CRUD for KB articles
- [ ] Knowledge base retrieval: Postgres full-text search to find articles relevant to a ticket
- [ ] AI-suggested reply: prompt combining ticket thread + summary + relevant KB articles
- [x] Frontend: AI category badge (editable) + AI summary panel (`TicketSummary`) + AI polish button in the reply composer
- [ ] Frontend: AI-suggested reply (editable before send)
- [ ] Frontend: admin KB management UI

## Phase 7 — Dashboard

- [x] Backend: aggregate stats endpoint (`GET /api/stats`: totals, open, AI-resolved, avg. resolution time, 30-day daily volume)
- [x] Frontend: dashboard page (`DashboardPage`) with KPI summary cards + a tickets-per-day volume chart (`TicketVolumeChart`)

## Phase 8 — Polish, Testing, Deployment

- [x] Request validation with Zod on all endpoints (via the `parseBody` helper)
- [x] Consistent API error response shape (`{ error: "<message>" }`, read client-side by `getServerErrorMessage`)
- [x] Automated tests: component (Vitest + RTL) and E2E (Playwright); AI service mocked
- [x] UI polish: cobalt-blue theme, semantic status/category color language, and a light/dark/system theme toggle (see CLAUDE.md → Theming & dark mode)
- [x] Error monitoring: Sentry on client (`@sentry/react`) + server (`@sentry/bun`), disabled by default when the DSN is unset
- [ ] Dockerfiles for client and server, production docker-compose
- [ ] Deploy to chosen cloud provider, document required env vars
- [ ] Basic logging/monitoring for production
