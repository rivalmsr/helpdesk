import { Router } from "express";
import { randomUUID } from "node:crypto";
import { inboundEmailSchema, TICKET_MESSAGE_TYPE, TICKET_STATUS } from "core";
import { prisma } from "../lib/prisma";
import { parseBody } from "../lib/validate";
import { verifyWebhookSecret } from "../lib/webhookAuth";

export const inboundEmailRouter = Router();

/**
 * Inbound-email webhook: turns a support email into a ticket.
 *
 * - Deduped by `messageId` so provider retries don't create duplicate tickets.
 * - Threaded by matching `inReplyTo`/`references` against existing messages: a
 *   reply appends to the matched ticket (reopening it if it was resolved/closed),
 *   otherwise a brand-new ticket is created.
 */
inboundEmailRouter.post("/", verifyWebhookSecret, async (req, res) => {
  const data = parseBody(inboundEmailSchema, req.body, res);
  if (!data) return;

  const { from, text, messageId, inReplyTo, references } = data;
  const subject = data.subject || "(no subject)";

  try {
    // Idempotency: a message we've already ingested maps to its existing ticket.
    if (messageId) {
      const seen = await prisma.ticketMessage.findUnique({
        where: { messageId },
        select: { ticketId: true },
      });
      if (seen) {
        res.json({ ticketId: seen.ticketId, created: false, deduped: true });
        return;
      }
    }

    // Threading: find the ticket this email is replying to, if any.
    const candidateIds = [inReplyTo, ...(references ?? [])].filter(
      (id): id is string => Boolean(id),
    );
    const parent =
      candidateIds.length > 0
        ? await prisma.ticketMessage.findFirst({
            where: { messageId: { in: candidateIds } },
            select: { ticketId: true, ticket: { select: { status: true } } },
          })
        : null;

    if (parent) {
      // Append to the existing thread, reopening the ticket if it was closed out.
      const reopen = parent.ticket.status !== TICKET_STATUS.open;
      await prisma.$transaction([
        prisma.ticketMessage.create({
          data: {
            id: randomUUID(),
            ticketId: parent.ticketId,
            type: TICKET_MESSAGE_TYPE.inbound,
            fromEmail: from,
            body: text,
            messageId,
            inReplyTo,
          },
        }),
        prisma.ticket.update({
          where: { id: parent.ticketId },
          data: reopen ? { status: TICKET_STATUS.open } : { updatedAt: new Date() },
        }),
      ]);
      res.json({ ticketId: parent.ticketId, created: false });
      return;
    }

    // No thread match: open a new ticket seeded with this first message.
    const ticketId = randomUUID();
    await prisma.ticket.create({
      data: {
        id: ticketId,
        subject,
        requesterEmail: from,
        messages: {
          create: {
            id: randomUUID(),
            type: TICKET_MESSAGE_TYPE.inbound,
            fromEmail: from,
            body: text,
            messageId,
            inReplyTo,
          },
        },
      },
    });
    res.status(201).json({ ticketId, created: true });
  } catch (error) {
    console.error("Failed to process inbound email:", error);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
});
