import express from "express";
import { toNodeHandler } from "better-auth/node";
import { prisma } from "./lib/prisma";
import { auth } from "./lib/auth";
import { usersRouter } from "./routes/users";
import { inboundEmailRouter } from "./routes/inbound-email";
import { ticketsRouter } from "./routes/tickets";

const app = express();
const port = process.env.PORT ?? 3001;

app.all("/api/auth/*splat", toNodeHandler(auth));

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

app.use("/api/users", usersRouter);
app.use("/api/inbound-email", inboundEmailRouter);
app.use("/api/tickets", ticketsRouter);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
