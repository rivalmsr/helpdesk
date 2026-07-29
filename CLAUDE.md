# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered ticket management system. Receives support emails, uses Claude to classify/summarize/suggest replies, and gives agents a dashboard to manage tickets. See `project-scope.md` for feature scope, `tech-stack.md` for the full intended stack, and `implementation-plan.md` for the phased build-out — the codebase currently implements Phase 1 (project scaffolding, Prisma/Postgres connection), not the data model or feature work from later phases yet.

## Commands

All commands run from the repo root using Bun workspaces (`client`, `server`).

- `bun dev` — run client (Vite) and server (Express) together via `concurrently`
- `bun dev:client` / `bun dev:server` — run one side only
- `bun build` — build both workspaces
- `bun --filter client lint` — lint the client with oxlint (server has no lint script yet)

Playwright is set up for end-to-end tests (see Testing below), but no test specs have been written yet. No unit/integration test suite exists in either workspace. When writing or running E2E tests, use the `e2e-test-writer` subagent (`.claude/agents/e2e-test-writer.md`) — it holds the detailed conventions and harness wiring.

`bun --filter server build` currently fails with `error TS2688: Cannot find type definition file for 'bun-types'` — this is a pre-existing issue unrelated to Prisma; `bun --watch` (used in dev) is unaffected since it doesn't type-check.

Ports: client dev server on `5173`, API server on `3001`. The Vite dev server proxies `/api/*` to `http://localhost:3001` (see `client/vite.config.ts`), so the client should call the API as same-origin relative paths (e.g. `fetch('/api/health')`), not an absolute `localhost:3001` URL.

## Architecture

Bun workspace monorepo with two packages:

- `server/` — Express + TypeScript, run directly with `bun --watch` in dev (no build step needed locally; `tsc` is only used for the production `build`/`start` scripts). Entry point `server/src/index.ts`.
- `client/` — React 19 + TypeScript, scaffolded with Vite, styled with Tailwind CSS v4 (via the `@tailwindcss/vite` plugin, imported in `client/src/index.css` with `@import "tailwindcss"`).

The two packages are independently deployable but developed together; the root `package.json` has no source of its own, only orchestration scripts.

## UI components (client)

`client/` uses shadcn/ui, installed via `bunx shadcn@latest init -d` (the CLI's current default preset). This is the `base-nova` preset: components are built on `@base-ui/react` primitives, not Radix — don't assume Radix APIs when reading or extending `client/src/components/ui/*`.

- Config: `client/components.json` (base color `neutral`, CSS variables, `lucide-react` icons).
- Path alias `@/*` → `client/src/*`, wired in `tsconfig.json`/`tsconfig.app.json` (`paths` only — no `baseUrl`, since the TS version here flags `baseUrl` as deprecated) and in `client/vite.config.ts` (`resolve.alias`).
- Forms use `client/src/components/ui/field.tsx` (`Field`, `FieldLabel`, `FieldError`, `FieldGroup`, etc.), not a `form.tsx`/`FormField` wrapper — this preset has no such component. `FieldError` takes RHF's error object straight from `formState.errors` via an `errors={[errors.foo]}` prop. See `client/src/pages/LoginPage.tsx` for the pattern (`Card` + `FieldGroup` + `Field` + `Input` + `Button`).
- Theme: default light/dark CSS variables and Chrome autofill override both live in `client/src/index.css`. Font is Geist Variable via `@fontsource-variable/geist`.
- Add components with `cd client && bunx shadcn@latest add <name>`. Names don't always match classic shadcn (e.g. `form` → `field`) — use `bunx shadcn@latest search @shadcn --query <term>` to check first.

## Data fetching (client)

Client-side API calls use **axios** for the HTTP request and **TanStack Query** (`@tanstack/react-query`) for fetching state — prefer these over raw `fetch`/`useEffect` for new code.

- The `QueryClient` and `QueryClientProvider` are set up at the app root in `client/src/main.tsx` (wrapping `<App />`), so `useQuery`/`useMutation` work anywhere in the tree.
- Fetch data with `useQuery({ queryKey, queryFn })`, where `queryFn` uses axios (e.g. `axios.get<T>('/api/...')` and returns `res.data`). Drive rendering off `isPending` / `isError` / `data`, not manual `useState`. See `client/src/pages/UsersPage.tsx` for the pattern.
- Call the API with same-origin relative paths (`/api/...`) so the Vite proxy handles it — see Commands above. Axios rejects on non-2xx by default, so no manual `res.ok` check is needed.
- Install client deps from **inside `client/`** (`cd client && bun add <pkg>`); the root `bun add --filter client <pkg>` currently fails with a Bun `DependencyLoop` error in this workspace.

## Database

Prisma 7 + PostgreSQL, scoped entirely to `server/`:

- `server/prisma/schema.prisma` — datasource + generator, plus the `User`/`Session`/`Account`/`Verification` models required by Better Auth (see Authentication below). The ticket/email domain model itself is still Phase 2 in `implementation-plan.md` and doesn't exist yet.
- `server/prisma.config.ts` — Prisma CLI config (schema/migrations paths, reads `DATABASE_URL` from `server/.env` via `dotenv/config`). Prisma 7 moved the datasource `url` out of `schema.prisma` and into this file — that's intentional, not a missing config.
- `server/src/lib/prisma.ts` — shared `PrismaClient` singleton. Prisma 7 requires an explicit driver adapter (no bundled query engine), so this uses `@prisma/adapter-pg` (`pg` + `@prisma/adapter-pg` packages).
- Generated client output: `server/src/generated/prisma` (gitignored, kept under `src/` so it satisfies `tsconfig.json`'s `rootDir`). Run `bun x prisma generate` from `server/` after changing the schema.
- Migrations: `bun x prisma migrate dev --name <name>` from `server/`.
- `server/.env` holds `DATABASE_URL` (gitignored, not committed) — point it at a local Postgres database.
- `/api/health` runs `SELECT 1` through Prisma, so it doubles as a DB connectivity check.

## Authentication

Better Auth, email/password only, with self-serve sign-up disabled — the only way to create a user is the seed script.

- `server/src/lib/auth.ts` — shared `betterAuth()` instance. `emailAndPassword: { enabled: true, disableSignUp: true }`. `trustedOrigins` defaults to `http://localhost:5173` via `CLIENT_ORIGIN` env var (not currently set in `server/.env`, so it's running on the default). Adds a required `role` field (`admin` | `agent`) to the user via `user.additionalFields`, with `input: false` — it can't be set through any auth API call, only written directly via Prisma (e.g. the seed script). The column is a Prisma `Role` enum (`admin` | `agent`) in `schema.prisma`.
- `server/src/lib/authorize.ts` — Express middleware for **server-side** authorization: `requireRole(...roles)` re-derives the session from the request cookies via `auth.api.getSession` (never trusts a client-supplied role), returns `401` if unauthenticated / `403` if the role doesn't match, and attaches the session to `req.session` (typed via a `declare global` augmentation of `Express.Request`). `requireAuth` is `requireRole()` with no roles (any authenticated user).
- `server/src/index.ts` — mounts the auth handler at `app.all("/api/auth/*splat", toNodeHandler(auth))`. The `*splat` named wildcard is Express 5 / path-to-regexp v8 syntax (a bare `*` is no longer a valid route pattern). This must be registered **before** `express.json()`, since Better Auth parses its own request body; adding `express.json()` earlier would break auth requests. Also exposes `GET /api/users`, guarded by `requireRole("admin")`, returning `{ id, name, email, role }` for all users.
- Data model: `User`, `Session`, `Account`, `Verification` in `server/prisma/schema.prisma`, matching Better Auth's expected shape and `@@map`-ed to lowercase table names. `Account` holds the hashed password for the `credential` provider (`providerId: "credential"`).
- `server/prisma/seed.ts` (run with `bun run seed` from `server/`) seeds users directly through Prisma via a `seedUser({ name, email, password, role })` helper — hashes the password with `hashPassword` from `better-auth/crypto` and creates matching `User` + `Account` (`providerId: "credential"`) rows, no-op if the email already exists. Always seeds an admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (required); **also** seeds an agent when `AGENT_EMAIL`/`AGENT_PASSWORD` are set (optional).
- Required `server/.env` vars for auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`; optional `AGENT_EMAIL`/`AGENT_PASSWORD` to also seed an agent (all gitignored, not committed).
- `client/src/lib/auth-client.ts` — `createAuthClient()` from `better-auth/react` with no `baseURL`, so it relies on same-origin requests through the Vite `/api` proxy (see Commands above). Uses the `inferAdditionalFields<typeof auth>()` plugin so `session.user.role` is typed. Exports `useSession`, `signIn`, `signOut`, plus the `ROLES` tuple and `Role` type.
- `client/src/App.tsx` — client-side routing with `react-router` (`BrowserRouter`/`Routes`/`Route`). A `ProtectedRoute` component redirects to `/login` when unauthenticated and to `/` when an optional `role` prop doesn't match `session.user.role`; routes are `/` (`HomePage`), `/login`, and `/users` (`UsersPage`, admin-only), with `*` → `/`. This is client-side guarding only (no route-loader protection) — the API is separately enforced by `requireRole` (above). `client/src/components/NavBar.tsx` reads `session.user.name`, calls `signOut()`, and shows a Users link only when `session.user.role === 'admin'`.
- `@better-auth/cli` (server devDependency) was used to scaffold the Better Auth Prisma schema/migrations initially; you generally won't need to run it again unless adding new Better Auth plugins that require schema changes.

## Validation (server)

Request-body validation on the server uses **Zod** (`zod`, v4, a `server` dependency) — validate untrusted input with a schema, not hand-rolled `typeof`/regex checks.

- Define a schema per route with `z.object({...})` and validate via `schema.safeParse(req.body)`. On failure, return `400` with the first issue's message: `res.status(400).json({ error: parsed.error.issues[0].message })`, then use the typed `parsed.data`. See the `createUserSchema` on `POST /api/users` in `server/src/index.ts` for the reference pattern.
- The `{ error: "<message>" }` single-string shape is the contract the client relies on (e.g. `CreateUserDialog` reads `error.response?.data?.error`) — keep it; don't return Zod's raw `flatten()`/`issues` array.
- Use Zod 4 APIs: top-level string formats like `z.email(msg)` (not the deprecated `z.string().email()`), and `.trim()` before format checks (e.g. `z.string().trim().pipe(z.email(msg))`) to match how fields were trimmed previously. Pass a custom message to each validator so the response stays user-friendly; non-string/missing fields fall back to Zod's default `"Invalid input: ..."` message.

## Testing (component)

Client component/unit tests use **Vitest + React Testing Library**, scoped to the `client` workspace. Specs are colocated next to the code as `client/src/**/*.test.tsx`. See `client/src/pages/UsersPage.test.tsx` for the reference pattern.

- **Run tests with `bun run test`, never bare `bun test`.** `bun test` invokes Bun's own test runner, which picks up the `*.test.tsx` files but provides only a partial `vi` shim (e.g. no `vi.mocked`) and fails. Commands: `bun --filter client test` / `bun --filter client test:watch` from the root, or `bun run test` / `bun run test:watch` from `client/`.
- Config lives in the `test` block of `client/vite.config.ts` (which imports `defineConfig` from `vitest/config`, a superset of Vite's): `environment: 'happy-dom'`, `globals: true`, `setupFiles: './src/test/setup.ts'`.
- **Environment is `happy-dom`, not `jsdom`** — jsdom pulls in `undici`, whose `CacheStorage` throws `webidl.util.markAsUncloneable is not a function` under Bun's runtime. Don't switch back to jsdom.
- `client/src/test/setup.ts` loads `@testing-library/jest-dom/vitest` matchers and runs RTL `cleanup()` after each test. `vitest/globals` is in `tsconfig.app.json`'s `types` so the globals (`describe`/`it`/`expect`/`vi`) typecheck.
- For components that use TanStack Query, render them via `renderWithQueryClient(ui)` from `client/src/test/render.tsx` — it wraps the tree in a fresh `QueryClientProvider` with `retryDelay: 0` so a component's own `retry` count reaches the error state without real backoff (which would blow the test timeout). Mock network calls by mocking axios with `vi.mock('axios', () => ({ default: { get: vi.fn() } }))`.

## Testing (E2E)

Playwright is configured at the repo root, running against a **separate test database** so runs never touch dev data.

**Always write or update E2E specs through the `e2e-test-writer` subagent** (`.claude/agents/e2e-test-writer.md`) — launch it via the Agent tool (`subagent_type: "e2e-test-writer"`) whenever the task involves adding, changing, or debugging tests in `e2e/`. It owns the detailed conventions (locator strategy, seeded users, parallel-safe specs) and the harness wiring, so don't hand-write specs in the main thread or duplicate those details here. Key facts to know without opening it:

- Config is `playwright.config.ts` (root); specs go in `e2e/`; `baseURL` is `http://localhost:5173`.
- Runs boot the real client + server against the test DB; `reuseExistingServer` is `false`, so **stop `bun dev` before running E2E** or the ports collide.
- `server/.env.test` (gitignored; template `server/.env.test.example`) holds the test `DATABASE_URL` + seed credentials; `e2e/global-setup.ts` migrates and seeds that DB once before tests.
- Commands (from root): `bun test:e2e`, `bun test:e2e:ui`, `bun test:e2e:report`. First-time setup: `bunx playwright install chromium`.

## Fetching library documentation (Context7 MCP)

Use the Context7 MCP tools to pull current docs whenever working with a library/framework in this repo (React, Express, Vite, Tailwind, Bun, Better Auth, Prisma, or anything added later) instead of relying on training data. This matters here because the stack pins specific majors (e.g. **Express 5**, **Prisma 7**, **Tailwind v4**, **React 19**) whose APIs differ from older training-data assumptions.

**Workflow — always two steps, in order:**
1. `mcp__context7__resolve-library-id` — pass the library name (e.g. `Express`) to get its Context7 ID (e.g. `/expressjs/express`). Skip this only if the user gives an ID in `/org/project` form directly.
2. `mcp__context7__query-docs` — pass that `libraryId` plus a specific, single-concept `query` (e.g. "Express 5 wildcard route syntax with path-to-regexp v8"), not a vague term. One call per distinct concept.

**Setup / configuration:** Context7 is registered as an MCP server for Claude Code (not an app dependency — it's not in any `package.json`). Manage it with the CLI, not by hand-editing configs:
- `claude mcp list` — see configured servers and their connection status.
- `claude mcp get context7` — inspect this server's transport/URL.
- Add (project scope, shared via a checked-in `.mcp.json`): `claude mcp add --transport http context7 https://mcp.context7.com/mcp --scope project --header "CONTEXT7_API_KEY: <key>"`, or the local stdio form `claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp`. Use `--scope user` for all-projects, or omit `--scope` for local-only.
- In-session, `/mcp` shows connection state and handles re-auth.

**If a call fails:** the tools may load but calls can fail at runtime with `TypeError: fetch failed` when the environment can't reach `mcp.context7.com` (blocked outbound HTTPS) or the `CONTEXT7_API_KEY` is missing/expired. When that happens, say so explicitly rather than silently falling back — then proceed using best knowledge and lean harder on empirical verification (typecheck, a real runtime/`curl` check) to confirm library behavior. Don't present unavailable docs as if they were consulted.
