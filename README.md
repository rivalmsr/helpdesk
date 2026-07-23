# Helpdesk

An AI-powered ticket management system. Incoming support emails become tickets that are automatically classified, summarized, and given a suggested reply drawn from a knowledge base — freeing agents to focus on complex issues instead of manual triage.

See [`project-scope.md`](./project-scope.md) for the full feature scope, [`tech-stack.md`](./tech-stack.md) for stack decisions, and [`implementation-plan.md`](./implementation-plan.md) for the phased build-out.

## Stack

- **Client**: React + TypeScript, Vite, Tailwind CSS
- **Server**: Express + TypeScript
- **Runtime/package manager**: Bun (workspaces monorepo)

## Getting Started

Requires [Bun](https://bun.sh).

```bash
bun install
bun dev
```

This runs both the client and server together:

- Client: http://localhost:5173
- Server: http://localhost:3001

The client dev server proxies `/api/*` requests to the server, so no CORS setup is needed in development.

### Other commands

```bash
bun dev:client   # run only the client
bun dev:server   # run only the server
bun build        # build both workspaces
```

## Project Structure

```
client/   React + TypeScript frontend (Vite, Tailwind CSS)
server/   Express + TypeScript backend
```

> **Status**: only Phase 1 (project scaffolding) of the implementation plan is complete — the features described in `project-scope.md` are not built yet.
