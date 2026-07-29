import { Router } from "express";
import { randomUUID } from "node:crypto";
import { createUserSchema } from "core";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/prisma";
import { requireRole } from "../lib/authorize";
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
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { name, email, password } = parsed.data;

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
