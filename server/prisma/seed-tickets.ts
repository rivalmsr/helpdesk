import "dotenv/config";
import { randomUUID } from "node:crypto";
import { TICKET_STATUS, TICKET_CATEGORY, TICKET_MESSAGE_TYPE } from "core";
import { prisma } from "../src/lib/prisma";

/**
 * Dev-only data generator: inserts 100 realistic, diversified support tickets
 * straight through Prisma (the inbound-email webhook can only ever produce
 * `open`/`general` tickets, so it can't exercise status/category sorting).
 *
 * Diversity is deliberate so the Tickets table's sort (and future filter) can be
 * tested end to end:
 *  - subject / requesterEmail: spread across the alphabet, not insertion order
 *  - status / category: all enum values well represented
 *  - createdAt: randomly scattered over the last ~120 days (NOT insertion order,
 *    so a createdAt sort is visibly different from the order rows were inserted)
 *  - message count: 1–6 per ticket, so `sort=messages` has a real gradient
 *
 * Run from the `server/` dir: `bun prisma/seed-tickets.ts`
 */

// Realistic support subjects grouped by category. Chosen to spread across the
// alphabet (A → W first letters) so subject sorting is clearly visible.
const SUBJECTS: Record<string, string[]> = {
  [TICKET_CATEGORY.technical]: [
    "App crashes on launch after the latest update",
    "Cannot log in — stuck on the loading spinner",
    "Dashboard charts fail to render in Safari",
    "Export to CSV produces an empty file",
    "Getting a 500 error when uploading attachments",
    "Push notifications stopped arriving on Android",
    "Two-factor authentication codes are rejected",
    "Webhook deliveries are timing out intermittently",
    "Search returns no results for valid queries",
    "Mobile app freezes when opening a large report",
    "API returns 401 despite a valid token",
    "Slow page loads since the weekend maintenance",
  ],
  [TICKET_CATEGORY.refund]: [
    "Requesting a refund for order #48213",
    "Charged twice for my monthly subscription",
    "Please cancel and refund my annual plan",
    "Refund not received after 10 business days",
    "Billed after cancelling my trial",
    "Duplicate charge on my credit card",
    "Wrong amount charged for the Pro upgrade",
    "Refund request for an accidental purchase",
    "Overcharged due to currency conversion",
    "Money taken but account never activated",
  ],
  [TICKET_CATEGORY.general]: [
    "How do I change the email on my account?",
    "Do you offer discounts for non-profits?",
    "Question about your data retention policy",
    "Can I invite teammates to my workspace?",
    "Where can I download an invoice?",
    "Is there a student or education plan?",
    "How do I upgrade from Starter to Pro?",
    "Feedback: love the new interface!",
    "Are you SOC 2 compliant?",
    "Can I schedule a product demo?",
    "Updating my company billing address",
    "What integrations do you support?",
  ],
};

// Realistic requester identities across a mix of consumer and company domains,
// with names spread across the alphabet for requesterEmail sorting.
const PEOPLE = [
  "Amelia Turner",
  "Benjamin Wong",
  "Carlos Mendez",
  "Diana Petrova",
  "Ethan Brooks",
  "Fatima Al-Sayed",
  "Grace Kim",
  "Hiroshi Tanaka",
  "Isabelle Laurent",
  "Jamal Robinson",
  "Katarzyna Nowak",
  "Liam O'Connor",
  "Maria Gonzalez",
  "Nadia Hassan",
  "Oliver Schmidt",
  "Priya Sharma",
  "Quentin Dubois",
  "Rebecca Stone",
  "Samuel Adeyemi",
  "Tara Nguyen",
  "Umar Farooq",
  "Valentina Rossi",
  "William Clarke",
  "Ximena Cruz",
  "Yusuf Demir",
  "Zoe Anderson",
];

const DOMAINS = [
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "proton.me",
  "acme.co",
  "globex.com",
  "initech.io",
  "umbrella.org",
  "hooli.com",
  "stark-industries.com",
];

const STATUSES = [
  TICKET_STATUS.open,
  TICKET_STATUS.resolved,
  TICKET_STATUS.closed,
];

const CATEGORIES = [
  TICKET_CATEGORY.technical,
  TICKET_CATEGORY.refund,
  TICKET_CATEGORY.general,
];

// A few canned agent replies, so multi-message tickets read realistically.
const AGENT_REPLIES = [
  "Thanks for reaching out — I'm looking into this now and will update you shortly.",
  "Could you share a screenshot and the exact time this happened so we can dig in?",
  "Good news: we've identified the issue and a fix is rolling out today.",
  "I've processed this on our end. You should see it reflected within 24 hours.",
  "Apologies for the trouble. I've escalated this to our engineering team.",
];

const CUSTOMER_FOLLOWUPS = [
  "Thanks for the quick reply — here are the details you asked for.",
  "That worked, appreciate the help!",
  "Still seeing the same problem after trying that, unfortunately.",
  "Any update on this? It's blocking my team.",
  "Confirmed on my end, you can close this out.",
];

const rand = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function emailFor(name: string): string {
  const [first, last] = name.toLowerCase().replace(/[^a-z ]/g, "").split(" ");
  const handle = rand([
    `${first}.${last}`,
    `${first}${last}`,
    `${first[0]}${last}`,
  ]);
  return `${handle}@${rand(DOMAINS)}`;
}

async function main() {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  let created = 0;
  for (let i = 0; i < 100; i++) {
    const category = rand(CATEGORIES);
    const status = rand(STATUSES);
    const subject = rand(SUBJECTS[category]);
    const person = rand(PEOPLE);
    const requesterEmail = emailFor(person);

    // Scatter across the last ~120 days (random, so not insertion order).
    const createdAt = new Date(now - randInt(0, 120) * DAY - randInt(0, DAY));

    // 1–6 messages: opening inbound + alternating agent/customer follow-ups.
    const messageCount = randInt(1, 6);
    const messages = Array.from({ length: messageCount }).map((_, m) => {
      const isInbound = m % 2 === 0;
      // Space each message a few hours after the previous one.
      const msgCreatedAt = new Date(createdAt.getTime() + m * randInt(1, 8) * 60 * 60 * 1000);
      return {
        id: randomUUID(),
        type: isInbound
          ? TICKET_MESSAGE_TYPE.inbound
          : TICKET_MESSAGE_TYPE.agent_reply,
        fromEmail: isInbound ? requesterEmail : "support@helpdesk.example",
        body: m === 0
          ? `Hi team,\n\n${subject}. Could you please help?\n\nThanks,\n${person.split(" ")[0]}`
          : isInbound
            ? rand(CUSTOMER_FOLLOWUPS)
            : rand(AGENT_REPLIES),
        messageId: `<${randomUUID()}@helpdesk.example>`,
        createdAt: msgCreatedAt,
      };
    });

    await prisma.ticket.create({
      data: {
        id: randomUUID(),
        subject,
        requesterEmail,
        status,
        category,
        createdAt,
        messages: { create: messages },
      },
    });
    created++;
  }

  // Report what landed, so the diversity is easy to eyeball.
  const [byStatus, byCategory, total] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], _count: true }),
    prisma.ticket.groupBy({ by: ["category"], _count: true }),
    prisma.ticket.count(),
  ]);
  console.log(`Created ${created} tickets. Total tickets now: ${total}`);
  console.log("By status:", Object.fromEntries(byStatus.map((r) => [r.status, r._count])));
  console.log("By category:", Object.fromEntries(byCategory.map((r) => [r.category, r._count])));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
