import { test, expect } from "@playwright/test";
import { login, AGENT } from "./helpers/auth";
import { postInboundEmail, uniqueMessageId } from "./helpers/webhook";

type Ticket = {
  id: string;
  subject: string;
  requesterEmail: string;
  status: string;
  _count: { messages: number };
};

/**
 * POST /api/inbound-email (server/src/routes/inbound-email.ts): turns a
 * support email into a ticket. Public endpoint guarded by a shared-secret
 * header rather than a session, so most cases here use the plain `request`
 * fixture. The threading/message-count cases additionally read back via the
 * authenticated GET /api/tickets to confirm what was actually persisted.
 */
test.describe("POST /api/inbound-email", () => {
  test("a first-contact email creates a new ticket with one message", async ({ page }) => {
    await login(page, AGENT);
    const from = "customer@e2e.test";
    const subject = `Help needed ${uniqueMessageId()}`;

    const res = await postInboundEmail(page.request, {
      from,
      subject,
      text: "My printer is on fire.",
      messageId: uniqueMessageId(),
    });

    expect(res.status()).toBe(201);
    const { ticketId, created } = await res.json();
    expect(created).toBe(true);

    const tickets: Ticket[] = await (await page.request.get("/api/tickets")).json();
    const ticket = tickets.find((t) => t.id === ticketId);
    expect(ticket).toMatchObject({ subject, requesterEmail: from, _count: { messages: 1 } });
  });

  test("a reply referencing an existing message's messageId (via inReplyTo) appends to the same ticket", async ({ page }) => {
    await login(page, AGENT);
    const parentMessageId = uniqueMessageId();

    const parentRes = await postInboundEmail(page.request, {
      from: "customer@e2e.test",
      subject: "Original issue",
      text: "It broke.",
      messageId: parentMessageId,
    });
    expect(parentRes.status()).toBe(201);
    const { ticketId: parentTicketId } = await parentRes.json();

    const replyRes = await postInboundEmail(page.request, {
      from: "customer@e2e.test",
      subject: "Re: Original issue",
      text: "Any update?",
      messageId: uniqueMessageId(),
      inReplyTo: parentMessageId,
    });

    expect(replyRes.status()).toBe(200);
    const replyBody = await replyRes.json();
    expect(replyBody).toMatchObject({ ticketId: parentTicketId, created: false });

    const tickets: Ticket[] = await (await page.request.get("/api/tickets")).json();
    const ticket = tickets.find((t) => t.id === parentTicketId);
    expect(ticket).toMatchObject({ _count: { messages: 2 } });
  });

  test("a reply matching an existing message via references[] threads into the same ticket", async ({ request }) => {
    const parentMessageId = uniqueMessageId();
    const parentRes = await postInboundEmail(request, {
      from: "customer@e2e.test",
      text: "Original message.",
      messageId: parentMessageId,
    });
    const { ticketId: parentTicketId } = await parentRes.json();

    const replyRes = await postInboundEmail(request, {
      from: "customer@e2e.test",
      text: "Follow-up via references header.",
      messageId: uniqueMessageId(),
      references: [uniqueMessageId(), parentMessageId],
    });

    expect(replyRes.status()).toBe(200);
    await expect(replyRes.json()).resolves.toMatchObject({
      ticketId: parentTicketId,
      created: false,
    });
  });

  test("reposting the same messageId is deduped and does not create a new ticket", async ({ request }) => {
    const payload = {
      from: "customer@e2e.test",
      subject: "Duplicate delivery",
      text: "Provider retried this email.",
      messageId: uniqueMessageId(),
    };

    const firstRes = await postInboundEmail(request, payload);
    expect(firstRes.status()).toBe(201);
    const { ticketId } = await firstRes.json();

    const secondRes = await postInboundEmail(request, payload);
    expect(secondRes.status()).toBe(200);
    await expect(secondRes.json()).resolves.toEqual({ ticketId, created: false, deduped: true });
  });

  test("an invalid sender email is rejected with 400", async ({ request }) => {
    const res = await postInboundEmail(request, {
      from: "not-an-email",
      text: "Some body text.",
      messageId: uniqueMessageId(),
    });

    expect(res.status()).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Enter a valid sender email address" });
  });

  test("an empty email body is rejected with 400", async ({ request }) => {
    const res = await postInboundEmail(request, {
      from: "customer@e2e.test",
      text: "",
      messageId: uniqueMessageId(),
    });

    expect(res.status()).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Email body is required" });
  });

  test("a missing X-Webhook-Secret header is rejected with 401", async ({ request }) => {
    const res = await request.post("/api/inbound-email", {
      data: {
        from: "customer@e2e.test",
        text: "Some body text.",
        messageId: uniqueMessageId(),
      },
    });

    expect(res.status()).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  test("a wrong X-Webhook-Secret header is rejected with 401", async ({ request }) => {
    const res = await postInboundEmail(
      request,
      { from: "customer@e2e.test", text: "Some body text.", messageId: uniqueMessageId() },
      "definitely-the-wrong-secret",
    );

    expect(res.status()).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
