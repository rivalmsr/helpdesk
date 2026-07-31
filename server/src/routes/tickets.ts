import { Router } from "express";
import { ticketListQuerySchema, TICKET_SORT_FIELD } from "core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/authorize";
import { parseBody } from "../lib/validate";

export const ticketsRouter = Router();

// Any authenticated agent or admin can view the ticket queue. `sort`/`order`
// query params drive server-side ordering (defaults to newest-first).
ticketsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseBody(ticketListQuerySchema, req.query, res);
  if (!query) return;

  // The message-count column sorts on the relation `_count`; every other
  // sortable field is a direct `Ticket` column.
  const orderBy =
    query.sort === TICKET_SORT_FIELD.messages
      ? { messages: { _count: query.order } }
      : { [query.sort]: query.order };

  const tickets = await prisma.ticket.findMany({
    select: {
      id: true,
      subject: true,
      requesterEmail: true,
      status: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
    orderBy,
  });
  res.json(tickets);
});
