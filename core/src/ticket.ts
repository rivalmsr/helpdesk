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
