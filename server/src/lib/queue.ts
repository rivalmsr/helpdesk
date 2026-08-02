import { PgBoss } from "pg-boss";
import { prisma } from "./prisma";
import { classifyTicket } from "./ai";

/**
 * Background job queue, backed by pg-boss on the same Postgres database (it
 * manages its own `pgboss` schema, created on `start()`). Replaces the previous
 * in-process fire-and-forget classification with a durable, retryable queue: a
 * job survives a server restart and is retried on transient failures, neither of
 * which the old detached promise could do.
 */

const CLASSIFY_QUEUE = "ticket-classify";

/** Payload for a ticket-classification job. */
type ClassifyTicketJob = {
  ticketId: string;
  subject: string;
  body: string;
};

// One boss instance per process, connected via the shared `DATABASE_URL`.
const boss = new PgBoss(process.env.DATABASE_URL as string);
boss.on("error", (err) => console.error("pg-boss error", err));

/**
 * Start pg-boss, create the classification queue (with a retry policy), and
 * register its worker. Call once on server boot. The worker classifies each
 * job's ticket and persists the category; a throw marks the job failed and lets
 * pg-boss retry per the queue's `retryLimit` — after which the ticket simply
 * keeps its default `general` category.
 */
export async function startQueue(): Promise<void> {
  await boss.start();
  await boss.createQueue(CLASSIFY_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
  });

  // pg-boss delivers jobs in a batch array; process each one.
  await boss.work<ClassifyTicketJob>(CLASSIFY_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const { ticketId, subject, body } = job.data;
      const category = await classifyTicket(subject, body);
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { category },
      });
    }
  });
}

/**
 * Enqueue a ticket-classification job. Resolves as soon as the job is durably
 * written to Postgres — the worker processes it out of band, so the inbound
 * webhook responds without waiting on the LLM.
 */
export async function enqueueClassifyTicket(
  job: ClassifyTicketJob,
): Promise<void> {
  await boss.send(CLASSIFY_QUEUE, job);
}
