# Tech Stack

## Frontend

- React with TypeScript
- Tailwind CSS
- React Router

## Backend

- Node.js with Express and TypeScript
- Database sessions for authentication

## Database

- PostgreSQL

## ORM

- Prisma

## AI

- Claude API (Anthropic) for ticket classification, summaries, and suggested replies
- **As implemented:** OpenAI `gpt-5-nano` via the Vercel AI SDK (`ai` + `@ai-sdk/openai`). Classification, summaries, and reply polish ship today; the code lives in `server/src/lib/ai.ts`. (This deviates from the Claude API intent above — CLAUDE.md is the source of truth for what's built.)

## Background jobs

- pg-boss — a PostgreSQL-backed job queue (reuses the app database) that runs ticket classification off the request path

## Email

- SendGrid or Mailgun for outbound replies and inbound webhooks

## Deployment

- Docker + cloud provider (AWS, Railway, Fly.io, etc.)

