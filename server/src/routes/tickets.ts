import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/authorize";

export const ticketsRouter = Router();

// Any authenticated agent or admin can view the ticket queue.
ticketsRouter.get("/", requireAuth, async (_req, res) => {
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
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});
