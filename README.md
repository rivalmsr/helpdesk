# Helpdesk

An AI-powered ticket management system. Incoming support emails become tickets that are automatically classified, summarized, and given a suggested reply drawn from a knowledge base — freeing agents to focus on complex issues instead of manual triage.

See [`project-scope.md`](./project-scope.md) for the full feature scope, [`tech-stack.md`](./tech-stack.md) for stack decisions, and [`implementation-plan.md`](./implementation-plan.md) for the phased build-out.

## Stack

- **Client**: React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query
- **Server**: Express 5 + TypeScript
- **Database**: PostgreSQL via Prisma 7
- **Auth**: Better Auth (email/password, `admin`/`agent` roles)
- **AI**: OpenAI `gpt-5-nano` via the Vercel AI SDK (ticket classification, knowledge-base auto-resolution, summaries, reply polish)
- **Background jobs**: pg-boss (Postgres-backed queue — runs ticket classification off the request path)
- **Runtime/package manager**: Bun (workspaces monorepo — `client`, `server`, and a shared `core` package)

## Getting Started

Requires [Bun](https://bun.sh) and a local **PostgreSQL** database.

1. **Install dependencies** (from the repo root):

   ```bash
   bun install
   ```

2. **Configure the server environment.** Create `server/.env`:

   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/helpdesk?schema=public"
   BETTER_AUTH_SECRET="a-long-random-string"
   BETTER_AUTH_URL="http://localhost:3001"
   ADMIN_EMAIL="admin@example.com"
   ADMIN_PASSWORD="password123"
   # Required for the AI features (classification, summaries, reply polish)
   OPENAI_API_KEY="sk-..."
   # Optional: also seed an agent, and secure the inbound-email webhook
   AGENT_EMAIL="agent@example.com"
   AGENT_PASSWORD="password123"
   INBOUND_EMAIL_SECRET="a-shared-webhook-secret"
   ```

   > pg-boss (the background job queue) creates its own `pgboss` schema in this
   > same database on first run — no extra setup or migration needed.

3. **Set up the database** (from `server/`):

   ```bash
   cd server
   bun x prisma migrate dev   # create tables
   bun run seed               # create the admin (and optional agent) user
   ```

4. **Run the app** (from the repo root):

   ```bash
   bun dev
   ```

   - Client: http://localhost:5173
   - Server: http://localhost:3001

   The client dev server proxies `/api/*` to the server, so no CORS setup is needed in development.

## Commands

Run from the repo root unless noted.

```bash
bun dev                  # run client + server together
bun dev:client           # run only the client
bun dev:server           # run only the server
bun build                # build both workspaces
bun --filter client lint # lint the client (oxlint)
bun --filter client test # client component tests (Vitest)
bun test:e2e             # Playwright end-to-end tests
```

### Testing

- **Component tests** (Vitest + React Testing Library) live next to the code as `client/src/**/*.test.tsx`.
- **E2E tests** (Playwright) live in `e2e/` and run against a **separate test database**. Copy [`server/.env.test.example`](./server/.env.test.example) to `server/.env.test`, then `bunx playwright install chromium` before the first run. Stop `bun dev` first, since E2E boots its own servers.

## Project Structure

```
client/   React + TypeScript frontend (Vite, Tailwind, shadcn/ui)
server/   Express + TypeScript backend (Prisma, Better Auth)
core/     Framework-agnostic code shared by client + server (Zod schemas, enums, types)
e2e/      Playwright end-to-end specs
```

## Status

Built so far: project scaffolding, authentication and admin user management, inbound email ingestion, and the agent-facing ticket UI (list + detail). The AI features are in place: on inbound email a pg-boss queue runs a single **triage** step that **classifies** the ticket and tries to **auto-resolve it from the knowledge base** (`server/knowledge-base.md`) — answering the customer and marking it AI-resolved, or handing it to a human when it can't. Tickets move through a lifecycle (`new → processing → ai_resolved | open → resolved | closed`); AI-handled tickets are hidden from the default list behind a "Show AI-handled" toggle. Plus **on-demand thread summaries** and **AI polish for draft replies** — all on OpenAI `gpt-5-nano` via the Vercel AI SDK. Still to come from Phase 6: admin CRUD for the knowledge base and AI-suggested reply drafts. See [`implementation-plan.md`](./implementation-plan.md) for the roadmap.
