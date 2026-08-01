import { Router } from "express";
import { randomUUID } from "node:crypto";
import { createUserSchema, updateUserSchema, ROLE } from "core";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/prisma";
import { requireRole } from "../lib/authorize";
import { parseBody } from "../lib/validate";

export const usersRouter = Router();

usersRouter.get("/", requireRole(ROLE.admin), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

usersRouter.post("/", requireRole(ROLE.admin), async (req, res) => {
  const data = parseBody(createUserSchema, req.body, res);
  if (!data) return;

  const { name, email, password } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const userId = randomUUID();
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      role: ROLE.agent,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: hashedPassword,
        },
      },
    },
    select: { id: true, name: true, email: true, role: true },
  });

  res.status(201).json(user);
});

usersRouter.patch<{ id: string }>("/:id", requireRole(ROLE.admin), async (req, res) => {
  const data = parseBody(updateUserSchema, req.body, res);
  if (!data) return;

  const { id } = req.params;
  const { name, email, password } = data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== id) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { name, email },
    select: { id: true, name: true, email: true, role: true },
  });

  // Only touch the password when a new one was supplied; an empty/omitted
  // password leaves the existing credential untouched.
  if (password) {
    const hashedPassword = await hashPassword(password);
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashedPassword },
    });
  }

  res.json(user);
});

usersRouter.delete<{ id: string }>("/:id", requireRole(ROLE.admin), async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (existing.role === ROLE.admin) {
    res.status(403).json({ error: "Admin users cannot be deleted" });
    return;
  }

  // Soft delete: flag the row instead of removing it, unassign any tickets the
  // agent owned (a soft delete doesn't fire the `onDelete: SetNull` FK cascade),
  // and revoke active sessions so the deleted user is signed out immediately.
  // One transaction so the delete and unassign can't diverge on a partial failure.
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
    prisma.ticket.updateMany({
      where: { assigneeId: id },
      data: { assigneeId: null },
    }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);

  res.status(204).end();
});
