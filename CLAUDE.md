# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered ticket management system. Receives support emails, uses Claude to classify/summarize/suggest replies, and gives agents a dashboard to manage tickets. See `project-scope.md` for feature scope, `tech-stack.md` for the full intended stack, and `implementation-plan.md` for the phased build-out — the codebase currently only implements Phase 1 (project scaffolding), not the features described in those docs yet.

## Commands

All commands run from the repo root using Bun workspaces (`client`, `server`).

- `bun dev` — run client (Vite) and server (Express) together via `concurrently`
- `bun dev:client` / `bun dev:server` — run one side only
- `bun build` — build both workspaces
- `bun --filter client lint` — lint the client with oxlint (server has no lint script yet)

No test suite exists yet in either workspace.

Ports: client dev server on `5173`, API server on `3001`. The Vite dev server proxies `/api/*` to `http://localhost:3001` (see `client/vite.config.ts`), so the client should call the API as same-origin relative paths (e.g. `fetch('/api/health')`), not an absolute `localhost:3001` URL.

## Architecture

Bun workspace monorepo with two packages:

- `server/` — Express + TypeScript, run directly with `bun --watch` in dev (no build step needed locally; `tsc` is only used for the production `build`/`start` scripts). Entry point `server/src/index.ts`.
- `client/` — React 19 + TypeScript, scaffolded with Vite, styled with Tailwind CSS v4 (via the `@tailwindcss/vite` plugin, imported in `client/src/index.css` with `@import "tailwindcss"`).

The two packages are independently deployable but developed together; the root `package.json` has no source of its own, only orchestration scripts.

## Fetching library documentation

Use the Context7 MCP tools to pull current docs whenever working with a library/framework in this repo (React, Express, Vite, Tailwind, Bun, or anything added later) instead of relying on training data — resolve the library ID first, then query docs for the specific API in question.
