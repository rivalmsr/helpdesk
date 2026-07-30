import { z } from "zod";

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
