import { Router } from "express";
import { TICKET_STATUS } from "core";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/authorize";

export const statsRouter = Router();

// The statuses that count as a completed resolution for the average-resolution-
// time metric: the AI auto-resolved it, an agent resolved it, or it was closed.
const RESOLVED_STATUSES = [
  TICKET_STATUS.ai_resolved,
  TICKET_STATUS.resolved,
  TICKET_STATUS.closed,
] as const;

// GET /api/stats — dashboard KPIs. Any authenticated agent/admin (same access as
// the ticket list). Returns raw counts plus an approximate average resolution
// time; the client derives the AI-resolved percentage from `aiResolved / total`.
// Number of days of history the daily-volume chart covers (including today).
const VOLUME_WINDOW_DAYS = 30;

statsRouter.get("/", requireAuth, async (_req, res) => {
  const [total, open, aiResolved, avgRows, volumeRows] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: TICKET_STATUS.open } }),
    prisma.ticket.count({ where: { status: TICKET_STATUS.ai_resolved } }),
    // No `resolvedAt` column exists, so resolution time is approximated as
    // `updatedAt - createdAt` for terminal tickets. Averaged in the DB (in
    // seconds) rather than pulling every row. Column/table names are quoted
    // camelCase to match Prisma's mapping; the status literals come from `core`.
    prisma.$queryRaw<{ avg: number | null }[]>(Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) AS avg
      FROM ticket
      WHERE status::text IN (${Prisma.join([...RESOLVED_STATUSES])})
    `),
    // Tickets created per day over the window. `generate_series` produces one row
    // per day so days with no tickets come back as a zero (a plain GROUP BY would
    // drop them, leaving gaps in the chart). `day` is formatted as a plain
    // `YYYY-MM-DD` string so it crosses the wire without timezone ambiguity.
    prisma.$queryRaw<{ day: string; count: number }[]>(Prisma.sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, COUNT(t.id)::int AS count
      FROM generate_series(
        CURRENT_DATE - ${VOLUME_WINDOW_DAYS - 1} * INTERVAL '1 day',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS d
      LEFT JOIN ticket t
        ON t."createdAt" >= d AND t."createdAt" < d + INTERVAL '1 day'
      GROUP BY d
      ORDER BY d
    `),
  ]);

  // Postgres AVG is NULL when no rows match; surface that as `null`.
  const rawAvg = avgRows[0]?.avg;
  const avgResolutionSeconds = rawAvg == null ? null : Number(rawAvg);

  // COUNT comes back as a number via the ::int cast; normalize defensively.
  const dailyVolume = volumeRows.map((r) => ({
    day: r.day,
    count: Number(r.count),
  }));

  res.json({ total, open, aiResolved, avgResolutionSeconds, dailyVolume });
});
