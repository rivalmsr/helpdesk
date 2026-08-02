# Implementation Plan

Based on `project-scope.md` and `tech-stack.md`. Stack: React + TS + Tailwind + React Router (frontend), Node/Express + TS with database-backed sessions (backend), PostgreSQL + Prisma, Claude API, SendGrid/Mailgun, Docker.

## Phase 1 — Project Setup & Foundations

- [ ] Scaffold repo structure: `client/` (React + Vite + TS) and `server/` (Express + TS)
- [ ] Configure ESLint/Prettier/tsconfig for both packages
- [ ] Set up Tailwind CSS in `client/`
- [ ] Set up React Router with a basic route shell
- [ ] Set up Prisma in `server/`, connect to PostgreSQL
- [ ] Add Docker Compose for local Postgres
- [ ] Add `.env` handling for DB URL, session secret, Claude API key, email provider keys
- [ ] Basic Express app skeleton: health check route, error-handling middleware, request logging

## Phase 2 — Data Model

- [ ] Design Prisma schema: `User` (role: admin/agent), `Session`, `Ticket` (status, category, subject, requester email, timestamps), `TicketMessage` (thread entries: inbound email, agent reply, AI-suggested draft), `KnowledgeBaseArticle` (title, content, tags)
- [ ] Run initial migration
- [ ] Seed script: create default admin user

## Phase 3 — Authentication & User Management

- [ ] Backend: session store backed by Postgres (e.g. `express-session` + Prisma/pg session adapter)
- [ ] Backend: login endpoint with password hashing (bcrypt), logout endpoint (destroys session row)
- [ ] Backend: auth middleware + role guard (admin-only vs agent routes)
- [ ] Backend: admin endpoints to create/list/deactivate agents
- [ ] Frontend: login page
- [ ] Frontend: session-aware route protection (redirect unauthenticated users)
- [ ] Frontend: admin user-management page (list agents, create-agent form)

## Phase 4 — Core Ticket Management

- [ ] Backend: list tickets endpoint with filtering (status, category, assignee) and sorting
- [ ] Backend: ticket detail endpoint (ticket + message thread)
- [ ] Backend: update ticket status/category endpoint
- [ ] Backend: add manual reply/message to a ticket
- [ ] Frontend: ticket list page with filter/sort controls
- [ ] Frontend: ticket detail page with thread view and status/category controls
- [ ] Frontend: manual reply form

## Phase 5 — Email Ingestion & Outbound

- [ ] Configure inbound email webhook endpoint (SendGrid Inbound Parse or Mailgun Routes)
- [ ] Parse inbound payload → create new ticket, or append to existing ticket by matching thread headers (`References`/`In-Reply-To`)
- [ ] Backend: outbound email service (send agent/AI replies via SendGrid/Mailgun API)
- [ ] Error handling + logging for webhook failures (malformed payloads, provider errors)

## Phase 6 — AI Features

> **Status / deviation:** the AI service is built on **OpenAI `gpt-5-nano` via the Vercel AI SDK** (`server/src/lib/ai.ts`), not the Claude API originally planned. Classification, summaries, and reply polish ship; the knowledge base and KB-grounded suggested replies do not yet.

- [x] Backend: LLM client wrapper + prompt templates (`server/src/lib/ai.ts`) — _uses OpenAI via the Vercel AI SDK instead of the Claude API_
- [x] AI ticket classification: auto-assign category on ticket creation, editable by agent — _runs off the request path via a **pg-boss** job queue (`server/src/lib/queue.ts`) so the inbound webhook stays fast_
- [x] AI summary: generate a thread summary, shown on ticket detail — _generated on demand (re-run each click); **not** stored in the DB_
- [x] AI reply polish: rewrite an agent's draft reply for clarity/tone (added beyond the original plan; not persisted)
- [ ] Knowledge base: admin CRUD for KB articles
- [ ] Knowledge base retrieval: Postgres full-text search to find articles relevant to a ticket
- [ ] AI-suggested reply: prompt combining ticket thread + summary + relevant KB articles
- [x] Frontend: AI category badge (editable) + AI summary panel (`TicketSummary`) + AI polish button in the reply composer
- [ ] Frontend: AI-suggested reply (editable before send)
- [ ] Frontend: admin KB management UI

## Phase 7 — Dashboard

- [ ] Backend: aggregate stats endpoint (counts by status/category, tickets per agent)
- [ ] Frontend: dashboard page with summary cards and recent-ticket feed

## Phase 8 — Polish, Testing, Deployment

- [ ] Request validation (e.g. zod) on all endpoints
- [ ] Consistent API error response shape
- [ ] Automated tests: auth flow, ticket CRUD, AI service (mocked)
- [ ] Dockerfiles for client and server, production docker-compose
- [ ] Deploy to chosen cloud provider, document required env vars
- [ ] Basic logging/monitoring for production
