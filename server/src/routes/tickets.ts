import { Router } from "express";
import { ticketListQuerySchema, TICKET_SORT_FIELD } from "core";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/authorize";
import { parseBody } from "../lib/validate";

export const ticketsRouter = Router();

// Any authenticated agent or admin can view the ticket queue. `sort`/`order`
// query params drive server-side ordering (defaults to newest-first);
// `status`/`category`/`q` are optional server-side filters (AND-ed together).
ticketsRouter.get("/", requireAuth, async (req, res) => {
  const query = parseBody(ticketListQuerySchema, req.query, res);
  if (!query) return;

  // The message-count column sorts on the relation `_count`; every other
  // sortable field is a direct `Ticket` column.
  const orderBy =
    query.sort === TICKET_SORT_FIELD.messages
      ? { messages: { _count: query.order } }
      : { [query.sort]: query.order };

  // `q` matches subject OR requester email, case-insensitively.
  const where: Prisma.TicketWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.q
      ? {
          OR: [
            { subject: { contains: query.q, mode: "insensitive" } },
            { requesterEmail: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where,
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
