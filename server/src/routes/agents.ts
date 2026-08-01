import { Router } from "express";
import { ROLE } from "core";
import { prisma } from "../lib/prisma";
import { requireRole } from "../lib/authorize";

export const agentsRouter = Router();

// The assignable agents for the ticket assign picker. Admin-only (assigning is a
// management action) and scoped to active agents — admins and soft-deleted users
// are never assignable. Distinct from `GET /api/users`, which returns every user.
agentsRouter.get("/", requireRole(ROLE.admin), async (_req, res) => {
  const agents = await prisma.user.findMany({
    where: { role: ROLE.agent, deletedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json(agents);
});
