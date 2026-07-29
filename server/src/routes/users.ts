import { Router } from "express";
import { randomUUID } from "node:crypto";
import { createUserSchema, updateUserSchema } from "core";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/prisma";
import { requireRole } from "../lib/authorize";
import { parseBody } from "../lib/validate";
import { Role } from "../generated/prisma/client";

export const usersRouter = Router();

usersRouter.get("/", requireRole("admin"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

usersRouter.post("/", requireRole("admin"), async (req, res) => {
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
      role: Role.agent,
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

usersRouter.patch<{ id: string }>("/:id", requireRole("admin"), async (req, res) => {
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
