import { z } from "zod";
import {
  TICKET_SORT_FIELDS,
  TICKET_SORT_FIELD,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  TICKET_SUBJECT_MAX_LENGTH,
  TICKET_BODY_MAX_LENGTH,
} from "./ticket";

/**
 * Shared validation schema for the inbound-email webhook (`POST /api/inbound-email`).
 * The provider-agnostic JSON shape a mail provider (or a `curl` test) posts to
 * turn an email into a ticket. `subject` may be empty (the route normalizes it to
 * "(no subject)"); `messageId`/`inReplyTo`/`references` carry the email threading
 * headers used to append replies to an existing ticket.
 */
export const inboundEmailSchema = z.object({
  from: z
    .string()
    .trim()
    .pipe(z.email("Enter a valid sender email address")),
  subject: z
    .string()
    .trim()
    .max(TICKET_SUBJECT_MAX_LENGTH, "Subject is too long")
    .default(""),
  text: z
    .string()
    .min(1, "Email body is required")
    .max(TICKET_BODY_MAX_LENGTH, "Email body is too long"),
  messageId: z.string().trim().min(1).optional(),
  inReplyTo: z.string().trim().min(1).optional(),
  references: z.array(z.string().trim().min(1)).optional(),
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;

/**
 * Query-param validation for the ticket list (`GET /api/tickets`). `sort`/`order`
 * drive the server-side Prisma `orderBy`; both `.default(...)` so a bare request
 * (no params) still resolves to the newest-first default the page has always used.
 * `status`/`category`/`q` are optional server-side filters (AND-ed together); `q`
 * is a case-insensitive contains over subject + requester email. The client omits
 * `q` when the search box is empty, so `min(1)` never trips on a blank value.
 * `page`/`pageSize` drive server-side pagination (`z.coerce` because query params
 * arrive as strings); both `.default(...)` so a bare request returns the first page.
 */
export const TICKET_PAGE_SIZE = 10;

export const ticketListQuerySchema = z.object({
  sort: z.enum(TICKET_SORT_FIELDS).default(TICKET_SORT_FIELD.createdAt),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(TICKET_PAGE_SIZE),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

/**
 * Body validation for updating a ticket (`PATCH /api/tickets/:id`). Every field
 * is optional — only the ones present are changed. `assigneeId` is the id of the
 * agent to assign or `null` to unassign (the route verifies it's an active agent,
 * and restricts assignment to admins); `status`/`category` are the triage fields
 * any agent may change. At least one field must be supplied.
 */
export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    assigneeId: z.string().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields to update",
  });

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/**
 * Body validation for an agent reply (`POST /api/tickets/:id/messages`). A reply
 * is just its `body`; the route stamps the sender (the signed-in agent's email)
 * and message type server-side. `.trim()` so a whitespace-only reply is rejected.
 */
export const createReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply body is required")
    .max(TICKET_BODY_MAX_LENGTH, "Reply body is too long"),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;

/**
 * Body validation for polishing a draft reply (`POST /api/tickets/:id/polish-reply`).
 * Same `{ body }` shape as `createReplySchema` — the route sends the agent's draft
 * to the AI model, which returns an improved version; nothing is persisted.
 */
export const polishReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply body is required")
    .max(TICKET_BODY_MAX_LENGTH, "Reply body is too long"),
});

export type PolishReplyInput = z.infer<typeof polishReplySchema>;
