import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  ticketListQuerySchema,
  updateTicketSchema,
  createReplySchema,
  polishReplySchema,
  TICKET_SORT_FIELD,
  TICKET_MESSAGE_TYPE,
  ROLE,
} from "core";
import type { Role } from "core";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../lib/authorize";
import { parseBody } from "../lib/validate";
import { polishReply, summarizeTicket } from "../lib/ai";

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

// Update a ticket. Any authenticated agent may change the triage fields
// (`status`/`category`), but assigning (`assigneeId`) is admin-only — assigning
// work is a management action, mirroring the admin-gated user routes. Only the
// fields present in the body are changed; `assigneeId: null` unassigns and a
// non-null id must belong to an active agent. Responds with the updated ticket
// in the same shape as `GET /:id`.
ticketsRouter.patch<{ id: string }>("/:id", requireAuth, async (req, res) => {
  const data = parseBody(updateTicketSchema, req.body, res);
  if (!data) return;

  // `assigneeId` present at all (even `null`) means an assignment change, which
  // requires admin. `status`/`category` alone are fine for any agent.
  const changingAssignee = data.assigneeId !== undefined;
  if (changingAssignee && (req.session!.user.role as Role) !== ROLE.admin) {
    res.status(403).json({ error: "Only admins can assign tickets" });
    return;
  }

  const existing = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  // A non-null assignee must be an active agent (soft-deleted users don't count).
  if (data.assigneeId) {
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
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(changingAssignee ? { assigneeId: data.assigneeId } : {}),
    },
    select: ticketDetailSelect,
  });

  res.json(ticket);
});

// Post an agent reply to a ticket's thread. Any authenticated agent may reply;
// the sender is the signed-in user (never client-supplied) and the entry is
// typed `agent_reply`. Bumps the ticket's `updatedAt` in the same transaction so
// the reply counts as activity, and responds with the updated ticket in the same
// shape as `GET /:id` (so the client can drop it straight into its cache).
ticketsRouter.post<{ id: string }>(
  "/:id/messages",
  requireAuth,
  async (req, res) => {
    const data = parseBody(createReplySchema, req.body, res);
    if (!data) return;

    const existing = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const [, ticket] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          id: randomUUID(),
          ticketId: req.params.id,
          type: TICKET_MESSAGE_TYPE.agent_reply,
          fromEmail: req.session!.user.email,
          body: data.body,
        },
      }),
      prisma.ticket.update({
        where: { id: req.params.id },
        data: { updatedAt: new Date() },
        select: ticketDetailSelect,
      }),
    ]);

    res.status(201).json(ticket);
  },
);

// POST /api/tickets/:id/polish-reply — improve an agent's draft reply with AI.
// Takes the draft `body`, returns an improved `{ text }`; nothing is persisted
// (the composer swaps the draft for the result). Looks up the ticket for the
// requester email so the polish can greet the customer by first name, and signs
// off with the agent's name (from the session, never the client). A 502 is
// returned when the AI call fails (e.g. `OPENAI_API_KEY` unset or upstream error).
ticketsRouter.post<{ id: string }>(
  "/:id/polish-reply",
  requireAuth,
  async (req, res) => {
    const data = parseBody(polishReplySchema, req.body, res);
    if (!data) return;

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: { requesterEmail: true },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    try {
      const text = await polishReply(data.body, {
        agentName: req.session!.user.name,
        customerFirstName: firstNameFromEmail(ticket.requesterEmail),
      });
      res.json({ text });
    } catch {
      res.status(502).json({ error: "Failed to polish reply" });
    }
  },
);

// POST /api/tickets/:id/summarize — generate an AI summary of the ticket and its
// full conversation history. Nothing is persisted: the client re-requests this on
// demand (each click regenerates), so no schema/body is needed — the ticket id in
// the URL is enough. Returns `{ summary }`; `404` if the ticket is unknown and a
// `502` when the AI call fails (e.g. `OPENAI_API_KEY` unset or upstream error).
ticketsRouter.post<{ id: string }>(
  "/:id/summarize",
  requireAuth,
  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: {
        subject: true,
        messages: {
          select: { fromEmail: true, body: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    try {
      const summary = await summarizeTicket(ticket.subject, ticket.messages);
      res.json({ summary });
    } catch {
      res.status(502).json({ error: "Failed to summarize ticket" });
    }
  },
);

// Best-effort first name from an email address (the ticket stores no requester
// name): the local part's first token, split on common separators and
// capitalized — `jane.doe@x.com` -> "Jane". Falls back to "there" ("Hi there,").
function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._+-]/)[0] ?? "";
  return first
    ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
    : "there";
}
