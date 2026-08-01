import { Router } from "express";
import {
  ticketListQuerySchema,
  assignTicketSchema,
  TICKET_SORT_FIELD,
  ROLE,
} from "core";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../lib/authorize";
import { parseBody } from "../lib/validate";

export const ticketsRouter = Router();

// The single-ticket shape returned by both `GET /:id` and `PATCH /:id`: the
// ticket, its assignee, and the full message thread (oldest-first). Kept as one
// const so the two routes stay in sync.
const ticketDetailSelect = {
  id: true,
  subject: true,
  requesterEmail: true,
  status: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true } },
  messages: {
    select: {
      id: true,
      type: true,
      fromEmail: true,
      body: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TicketSelect;

// Any authenticated agent or admin can view the ticket queue. `sort`/`order`
// query params drive server-side ordering (defaults to newest-first);
// `status`/`category`/`q` are optional server-side filters (AND-ed together);
// `page`/`pageSize` paginate. Responds with `{ tickets, total, page, pageSize }`.
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

  const { page, pageSize } = query;

  // Fetch the requested page and the total (for page-count) against the same
  // filter in one round trip.
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page, pageSize });
});

// A single ticket with its full message thread (oldest-first), for the ticket
// detail page. Any authenticated agent or admin can view it; `404` if unknown.
ticketsRouter.get<{ id: string }>("/:id", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: ticketDetailSelect,
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(ticket);
});

// Assign (or unassign) a ticket. Admin-only — assigning work is a management
// action, mirroring the admin-gated user routes. `assigneeId: null` unassigns;
// a non-null id must belong to an active agent. Responds with the updated ticket
// in the same shape as `GET /:id`.
ticketsRouter.patch<{ id: string }>("/:id", requireRole(ROLE.admin), async (req, res) => {
  const data = parseBody(assignTicketSchema, req.body, res);
  if (!data) return;

  const existing = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (data.assigneeId !== null) {
    const agent = await prisma.user.findUnique({
      where: { id: data.assigneeId },
      select: { role: true, deletedAt: true },
    });
    if (!agent || agent.deletedAt || agent.role !== ROLE.agent) {
      res.status(400).json({ error: "Assignee must be an active agent" });
      return;
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: { assigneeId: data.assigneeId },
    select: ticketDetailSelect,
  });

  res.json(ticket);
});
