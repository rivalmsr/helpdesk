import { randomUUID } from "node:crypto";
import { PgBoss } from "pg-boss";
import { TICKET_MESSAGE_TYPE, TICKET_STATUS } from "core";
import { prisma } from "./prisma";
import { triageTicket } from "./ai";
import { getKnowledgeBase } from "./knowledgeBase";

/**
 * Background job queue, backed by pg-boss on the same Postgres database (it
 * manages its own `pgboss` schema, created on `start()`). Runs ticket **triage**
 * off the request path: for each newly-created ticket the worker classifies it and
 * attempts to auto-resolve it from the knowledge base. The queue makes this
 * durable and retryable — a job survives a server restart and is retried on
 * transient failures, neither of which an in-process detached promise could do.
 */

const TRIAGE_QUEUE = "ticket-triage";

/** The sender recorded on the AI's auto-resolution reply in the ticket thread. */
const AI_SENDER_EMAIL = "assistant@helpdesk.local";

/** Payload for a ticket-triage job. */
type TriageTicketJob = {
  ticketId: string;
  subject: string;
  body: string;
};

// One boss instance per process, connected via the shared `DATABASE_URL`.
const boss = new PgBoss(process.env.DATABASE_URL as string);
boss.on("error", (err) => console.error("pg-boss error", err));

/**
 * Start pg-boss, create the triage queue (with a retry policy), and register its
 * worker. Call once on server boot. Per job the worker drives the AI-owned
 * lifecycle: it marks the ticket `processing`, then either auto-resolves it
 * (`ai_resolved` + an `ai_reply` message) or hands it to a human (`open`). A throw
 * marks the job failed and lets pg-boss retry per the queue's `retryLimit`; the
 * `catch` first drops the ticket to `open` so a failed run never leaves it stuck
 * (and hidden) in `processing`.
 */
export async function startQueue(): Promise<void> {
  await boss.start();
  await boss.createQueue(TRIAGE_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
  });

  // pg-boss delivers jobs in a batch array; process each one.
  await boss.work<TriageTicketJob>(TRIAGE_QUEUE, async (jobs) => {
    for (const job of jobs) {
      const { ticketId, subject, body } = job.data;
      try {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: { status: TICKET_STATUS.processing },
        });

        const triage = await triageTicket(subject, body, getKnowledgeBase());

        if (triage.resolved) {
          // Auto-resolved from the KB: record the AI's answer and mark the ticket.
          await prisma.$transaction([
            prisma.ticket.update({
              where: { id: ticketId },
              data: {
                category: triage.category,
                status: TICKET_STATUS.ai_resolved,
              },
            }),
            prisma.ticketMessage.create({
              data: {
                id: randomUUID(),
                ticketId,
                type: TICKET_MESSAGE_TYPE.ai_reply,
                fromEmail: AI_SENDER_EMAIL,
                body: triage.reply,
              },
            }),
          ]);
        } else {
          // The AI couldn't resolve it — hand the classified ticket to a human.
          await prisma.ticket.update({
            where: { id: ticketId },
            data: { category: triage.category, status: TICKET_STATUS.open },
          });
        }
      } catch (err) {
        // Never leave a ticket stuck (and hidden) in `processing`: surface it to a
        // human. Best-effort — swallow this update's own error so the original
        // failure is what pg-boss sees and retries.
        await prisma.ticket
          .update({
            where: { id: ticketId },
            data: { status: TICKET_STATUS.open },
          })
          .catch(() => {});
        throw err;
      }
    }
  });
}

/**
 * Enqueue a ticket-triage job. Resolves as soon as the job is durably written to
 * Postgres — the worker processes it out of band, so the inbound webhook responds
 * without waiting on the LLM.
 */
export async function enqueueTriageTicket(job: TriageTicketJob): Promise<void> {
  await boss.send(TRIAGE_QUEUE, job);
}
