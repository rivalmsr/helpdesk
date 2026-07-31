import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { login, AGENT } from "./helpers/auth";
import { postInboundEmail, uniqueMessageId } from "./helpers/webhook";

type Ticket = {
  id: string;
  subject: string;
  requesterEmail: string;
  status: string;
  category: string;
  createdAt: string;
  _count: { messages: number };
};

/**
 * GET /api/tickets (server/src/routes/tickets.ts): lists tickets for any
 * authenticated agent/admin, with `sort`/`order` query params driving the
 * Prisma `orderBy`. The DB is shared across parallel specs, so every test
 * seeds its own tickets under a unique subject token and filters the
 * response down to just those before asserting on order.
 */
test.describe("GET /api/tickets sorting", () => {
  test("sorts by subject ascending and descending", async ({ page }) => {
    await login(page, AGENT);
    const token = randomUUID();
    // Insertion order is deliberately not alphabetical, so an ascending sort
    // is distinguishable from insertion/createdAt order.
    const subjects = [`${token} Zebra`, `${token} Mango`, `${token} Apple`];
    for (const subject of subjects) {
      const res = await postInboundEmail(page.request, {
        from: "customer@e2e.test",
        subject,
        text: "body",
        messageId: uniqueMessageId(),
      });
      expect(res.status()).toBe(201);
    }

    const ascRes = await page.request.get("/api/tickets", {
      params: { sort: "subject", order: "asc" },
    });
    const ascTickets: Ticket[] = await ascRes.json();
    const ascSubjects = ascTickets.map((t) => t.subject).filter((s) => s.startsWith(token));
    expect(ascSubjects).toEqual([`${token} Apple`, `${token} Mango`, `${token} Zebra`]);

    const descRes = await page.request.get("/api/tickets", {
      params: { sort: "subject", order: "desc" },
    });
    const descTickets: Ticket[] = await descRes.json();
    const descSubjects = descTickets.map((t) => t.subject).filter((s) => s.startsWith(token));
    expect(descSubjects).toEqual([`${token} Zebra`, `${token} Mango`, `${token} Apple`]);
  });

  test("omitting sort params defaults to newest-first", async ({ page }) => {
    await login(page, AGENT);
    const token = randomUUID();
    const subjects = [`${token} first`, `${token} second`, `${token} third`];
    for (const subject of subjects) {
      const res = await postInboundEmail(page.request, {
        from: "customer@e2e.test",
        subject,
        text: "body",
        messageId: uniqueMessageId(),
      });
      expect(res.status()).toBe(201);
    }

    const res = await page.request.get("/api/tickets");
    const tickets: Ticket[] = await res.json();
    const ownSubjects = tickets.map((t) => t.subject).filter((s) => s.startsWith(token));
    expect(ownSubjects).toEqual([`${token} third`, `${token} second`, `${token} first`]);
  });

  test("an invalid sort value is rejected with 400", async ({ page }) => {
    await login(page, AGENT);

    const res = await page.request.get("/api/tickets", { params: { sort: "bogus" } });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  test("sorts by message count descending", async ({ page }) => {
    await login(page, AGENT);
    const token = randomUUID();
    const quietSubject = `${token} quiet`;
    const busySubject = `${token} busy`;

    const quietRes = await postInboundEmail(page.request, {
      from: "customer@e2e.test",
      subject: quietSubject,
      text: "one message only",
      messageId: uniqueMessageId(),
    });
    expect(quietRes.status()).toBe(201);

    const busyParentMessageId = uniqueMessageId();
    const busyRes = await postInboundEmail(page.request, {
      from: "customer@e2e.test",
      subject: busySubject,
      text: "first message",
      messageId: busyParentMessageId,
    });
    expect(busyRes.status()).toBe(201);
    const replyRes = await postInboundEmail(page.request, {
      from: "customer@e2e.test",
      subject: `Re: ${busySubject}`,
      text: "second message",
      messageId: uniqueMessageId(),
      inReplyTo: busyParentMessageId,
    });
    expect(replyRes.status()).toBe(200);

    const res = await page.request.get("/api/tickets", {
      params: { sort: "messages", order: "desc" },
    });
    const tickets: Ticket[] = await res.json();
    const ownSubjects = tickets.map((t) => t.subject).filter((s) => s.startsWith(token));
    expect(ownSubjects).toEqual([busySubject, quietSubject]);
  });
});
