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

No test suite exists yet in either workspace.

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

- `server/src/lib/auth.ts` — shared `betterAuth()` instance. `emailAndPassword: { enabled: true, disableSignUp: true }`. `trustedOrigins` defaults to `http://localhost:5173` via `CLIENT_ORIGIN` env var (not currently set in `server/.env`, so it's running on the default). Adds a required `role` field (`admin` | `agent`) to the user via `user.additionalFields`, with `input: false` — it can't be set through any auth API call, only written directly via Prisma (e.g. the seed script).
- `server/src/index.ts` — mounts the handler at `app.all("/api/auth/*", toNodeHandler(auth))`. This must be registered **before** `express.json()`, since Better Auth parses its own request body; adding `express.json()` earlier would break auth requests.
- Data model: `User`, `Session`, `Account`, `Verification` in `server/prisma/schema.prisma`, matching Better Auth's expected shape and `@@map`-ed to lowercase table names. `Account` holds the hashed password for the `credential` provider (`providerId: "credential"`).
- `server/prisma/seed.ts` (run with `bun run seed` from `server/`) creates a single admin user directly through Prisma — hashes `ADMIN_PASSWORD` with `hashPassword` from `better-auth/crypto` and creates matching `User` (`role: admin`) and `Account` (`providerId: "credential"`) rows. Requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `server/.env`; no-ops if a user with that email already exists.
- Required `server/.env` vars for auth: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (all gitignored, not committed).
- `client/src/lib/auth-client.ts` — `createAuthClient()` from `better-auth/react` with no `baseURL`, so it relies on same-origin requests through the Vite `/api` proxy (see Commands above). Exports `useSession`, `signIn`, `signOut`.
- `client/src/App.tsx` — client-side route guarding: `useSession()` gates `/` vs `/login` with `<Navigate>` redirects (no server-side/route-loader protection). `client/src/components/NavBar.tsx` reads `session.user.name` and calls `signOut()`.
- `@better-auth/cli` (server devDependency) was used to scaffold the Better Auth Prisma schema/migrations initially; you generally won't need to run it again unless adding new Better Auth plugins that require schema changes.

## Fetching library documentation

Use the Context7 MCP tools to pull current docs whenever working with a library/framework in this repo (React, Express, Vite, Tailwind, Bun, or anything added later) instead of relying on training data — resolve the library ID first, then query docs for the specific API in question.
