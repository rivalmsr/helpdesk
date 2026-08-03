/**
 * Ticket taxonomy — the single source of truth for ticket status, category, and
 * message type, shared across the client and server and mirrored by the Prisma
 * `TicketStatus` / `TicketCategory` / `TicketMessageType` enums in the database
 * schema. Keep these values in sync with those enums (see
 * `server/prisma/schema.prisma`). Same `X`/`XS`/`Type` triple pattern as `role.ts`.
 */
export const TICKET_STATUS = {
  // AI-owned lifecycle: a new ticket is triaged by the AI, which either resolves
  // it from the knowledge base (`ai_resolved`) or hands it to a human (`open`).
  new: "new",
  processing: "processing",
  ai_resolved: "ai_resolved",
  // Agent-owned: a human works an `open` ticket and resolves or closes it.
  open: "open",
  resolved: "resolved",
  closed: "closed",
} as const;

export const TICKET_STATUSES = [
  TICKET_STATUS.new,
  TICKET_STATUS.processing,
  TICKET_STATUS.ai_resolved,
  TICKET_STATUS.open,
  TICKET_STATUS.resolved,
  TICKET_STATUS.closed,
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * The statuses partition into two "ownership" phases:
 *
 * - `AI_OWNED_TICKET_STATUSES` — set only by the triage pipeline (`new` on arrival,
 *   `processing` while the AI runs, `ai_resolved` when it answers from the KB).
 *   These are hidden from the default ticket list and revealed by the "Show
 *   AI-handled" toggle (`includeAiHandled` on the list query).
 * - `AGENT_TICKET_STATUSES` — the statuses a human agent may set (and filter by):
 *   `open` (needs attention), `resolved` (manually solved), `closed`. The update
 *   endpoint validates against this subset so an agent can't set an AI-only status.
 */
export const AI_OWNED_TICKET_STATUSES = [
  TICKET_STATUS.new,
  TICKET_STATUS.processing,
  TICKET_STATUS.ai_resolved,
] as const;

export const AGENT_TICKET_STATUSES = [
  TICKET_STATUS.open,
  TICKET_STATUS.resolved,
  TICKET_STATUS.closed,
] as const;

export const TICKET_CATEGORY = {
  general: "general",
  technical: "technical",
  refund: "refund",
} as const;

export const TICKET_CATEGORIES = [
  TICKET_CATEGORY.general,
  TICKET_CATEGORY.technical,
  TICKET_CATEGORY.refund,
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/**
 * The columns the ticket list (`GET /api/tickets`) can be sorted by. Shared so
 * the client's TanStack Table column ids and the server's Prisma `orderBy` stay
 * in lockstep — `messages` sorts on the related message `_count`, the rest are
 * direct `Ticket` columns. Same `X`/`XS`/`Type` triple pattern as above.
 */
export const TICKET_SORT_FIELD = {
  subject: "subject",
  requesterEmail: "requesterEmail",
  status: "status",
  category: "category",
  messages: "messages",
  createdAt: "createdAt",
} as const;

export const TICKET_SORT_FIELDS = [
  TICKET_SORT_FIELD.subject,
  TICKET_SORT_FIELD.requesterEmail,
  TICKET_SORT_FIELD.status,
  TICKET_SORT_FIELD.category,
  TICKET_SORT_FIELD.messages,
  TICKET_SORT_FIELD.createdAt,
] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

/**
 * The kind of thread entry a `TicketMessage` represents: `inbound` (email
 * ingestion), `agent_reply` (an agent's reply from the detail page), and
 * `ai_reply` (the KB-grounded answer the triage pipeline posts when it
 * auto-resolves a ticket). `ai_draft` is reserved for later (AI-suggested drafts).
 */
export const TICKET_MESSAGE_TYPE = {
  inbound: "inbound",
  agent_reply: "agent_reply",
  ai_reply: "ai_reply",
  ai_draft: "ai_draft",
} as const;

export const TICKET_MESSAGE_TYPES = [
  TICKET_MESSAGE_TYPE.inbound,
  TICKET_MESSAGE_TYPE.agent_reply,
  TICKET_MESSAGE_TYPE.ai_reply,
  TICKET_MESSAGE_TYPE.ai_draft,
] as const;

export type TicketMessageType = (typeof TICKET_MESSAGE_TYPES)[number];

/**
 * Maximum accepted lengths for free-text ticket content, enforced by the shared
 * Zod schemas (`ticket.schema.ts`) so oversized input is rejected with a clean
 * `400` before it reaches the DB, and mirrored as `@db.VarChar(...)` backstops on
 * the `Ticket.subject` / `TicketMessage.body` columns in `schema.prisma` (keep
 * those literals in sync with these values). `body` covers both inbound emails
 * and agent replies; 50k is generous for a long quoted thread while still capping
 * abusive multi-megabyte payloads.
 */
export const TICKET_SUBJECT_MAX_LENGTH = 200;
export const TICKET_BODY_MAX_LENGTH = 50_000;
