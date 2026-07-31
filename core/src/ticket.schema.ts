import { z } from "zod";
import {
  TICKET_SORT_FIELDS,
  TICKET_SORT_FIELD,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
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
  subject: z.string().trim().default(""),
  text: z.string().min(1, "Email body is required"),
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
 */
export const ticketListQuerySchema = z.object({
  sort: z.enum(TICKET_SORT_FIELDS).default(TICKET_SORT_FIELD.createdAt),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  q: z.string().trim().min(1).optional(),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
