import express from "express";
import { toNodeHandler } from "better-auth/node";
import { prisma } from "./lib/prisma";
import { auth } from "./lib/auth";
import { requireRole } from "./lib/authorize";

const app = express();
const port = process.env.PORT ?? 3001;

app.all("/api/auth/*", toNodeHandler(auth));

// express.json() must come after the Better Auth handler above,
// since Better Auth parses its own request body.
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.get("/api/users", requireRole("admin"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
