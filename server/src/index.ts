// Must be first: initializes Sentry before any other module is imported.
import "./instrument";

import * as Sentry from "@sentry/bun";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { prisma } from "./lib/prisma";
import { auth } from "./lib/auth";
import { usersRouter } from "./routes/users";
import { inboundEmailRouter } from "./routes/inbound-email";
import { ticketsRouter } from "./routes/tickets";
import { agentsRouter } from "./routes/agents";
import { statsRouter } from "./routes/stats";
import { startQueue } from "./lib/queue";

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
app.use("/api/agents", agentsRouter);
app.use("/api/stats", statsRouter);

// Report errors thrown from the routes above to Sentry. Must come after all
// routes but before any other error-handling middleware. No-op when Sentry is
// disabled (unset DSN).
Sentry.setupExpressErrorHandler(app);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

// Start the pg-boss job queue (ticket classification worker). Non-fatal: if it
// can't start, the API still serves — tickets just keep their default category.
startQueue()
  .then(() => console.log("Job queue started"))
  .catch((err) => {
    console.error("Failed to start job queue", err);
    Sentry.captureException(err);
  });
