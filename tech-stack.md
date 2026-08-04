# Tech Stack

## Frontend

- React with TypeScript
- Tailwind CSS
- React Router
- **As implemented:** Vite (build/dev), shadcn/ui on `@base-ui/react` primitives, TanStack Query + axios for data fetching, and a custom **cobalt-blue theme** with a **semantic status/category color language** and a light/dark/system **theme toggle** (see CLAUDE.md → Theming & dark mode)

## Backend

- Node.js with Express and TypeScript
- Database sessions for authentication
- **As implemented:** runs on the **Bun** runtime (workspaces monorepo with a shared `core` package); authentication is **Better Auth** (email/password, `admin`/`agent` roles, Postgres-backed sessions), not a hand-rolled session store

## Database

- PostgreSQL

## ORM

- Prisma

## AI

- Claude API (Anthropic) for ticket classification, summaries, and suggested replies
- **As implemented:** OpenAI `gpt-5-nano` via the Vercel AI SDK (`ai` + `@ai-sdk/openai`). Classification, knowledge-base auto-resolution, summaries, and reply polish ship today; the code lives in `server/src/lib/ai.ts`. (This deviates from the Claude API intent above — CLAUDE.md is the source of truth for what's built.)

## Knowledge base

- A static markdown file (`server/knowledge-base.md`) of support policies and troubleshooting guides, loaded whole into the triage prompt so the AI can auto-resolve tickets it fully covers. No admin CRUD or full-text retrieval yet (Phase 6).

## Background jobs

- pg-boss — a PostgreSQL-backed job queue (reuses the app database) that runs ticket classification off the request path

## Email

- SendGrid or Mailgun for outbound replies and inbound webhooks
- **As implemented:** inbound is a **provider-agnostic JSON webhook** (`POST /api/inbound-email`, shared-secret header), not wired to a specific provider yet; outbound email sending is **not built** (replies are stored on the ticket)

## Error monitoring

- **As implemented:** Sentry on both packages — `@sentry/react` (client) and `@sentry/bun` (server); non-fatal by design (disabled when the DSN is unset). See CLAUDE.md → Error monitoring.

## Deployment

- Docker + cloud provider (AWS, Railway, Fly.io, etc.)
- **As implemented:** not set up yet — no Dockerfiles / compose or deploy config (run locally with `bun dev` against a local Postgres)

