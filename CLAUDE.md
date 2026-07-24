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

## Database

Prisma 7 + PostgreSQL, scoped entirely to `server/`:

- `server/prisma/schema.prisma` — datasource + generator only, no models yet (data model is Phase 2 in `implementation-plan.md`)
- `server/prisma.config.ts` — Prisma CLI config (schema/migrations paths, reads `DATABASE_URL` from `server/.env` via `dotenv/config`). Prisma 7 moved the datasource `url` out of `schema.prisma` and into this file — that's intentional, not a missing config.
- `server/src/lib/prisma.ts` — shared `PrismaClient` singleton. Prisma 7 requires an explicit driver adapter (no bundled query engine), so this uses `@prisma/adapter-pg` (`pg` + `@prisma/adapter-pg` packages).
- Generated client output: `server/src/generated/prisma` (gitignored, kept under `src/` so it satisfies `tsconfig.json`'s `rootDir`). Run `bun x prisma generate` from `server/` after changing the schema.
- Migrations: `bun x prisma migrate dev --name <name>` from `server/`.
- `server/.env` holds `DATABASE_URL` (gitignored, not committed) — point it at a local Postgres database.
- `/api/health` runs `SELECT 1` through Prisma, so it doubles as a DB connectivity check.

## Fetching library documentation

Use the Context7 MCP tools to pull current docs whenever working with a library/framework in this repo (React, Express, Vite, Tailwind, Bun, or anything added later) instead of relying on training data — resolve the library ID first, then query docs for the specific API in question.
