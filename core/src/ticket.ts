/**
 * Ticket taxonomy — the single source of truth for ticket status, category, and
 * message type, shared across the client and server and mirrored by the Prisma
 * `TicketStatus` / `TicketCategory` / `TicketMessageType` enums in the database
 * schema. Keep these values in sync with those enums (see
 * `server/prisma/schema.prisma`). Same `X`/`XS`/`Type` triple pattern as `role.ts`.
 */
export const TICKET_STATUS = {
  open: "open",
  resolved: "resolved",
  closed: "closed",
} as const;

export const TICKET_STATUSES = [
  TICKET_STATUS.open,
  TICKET_STATUS.resolved,
  TICKET_STATUS.closed,
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

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
 * The kind of thread entry a `TicketMessage` represents. Only `inbound` is
 * produced today (by email ingestion); `agent_reply` and `ai_draft` are
 * reserved for later phases (manual replies, AI-suggested drafts).
 */
export const TICKET_MESSAGE_TYPE = {
  inbound: "inbound",
  agent_reply: "agent_reply",
  ai_draft: "ai_draft",
} as const;

export const TICKET_MESSAGE_TYPES = [
  TICKET_MESSAGE_TYPE.inbound,
  TICKET_MESSAGE_TYPE.agent_reply,
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
