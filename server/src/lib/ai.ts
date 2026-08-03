import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { TICKET_CATEGORIES, TICKET_CATEGORY, type TicketCategory } from "core";

/** Context the polish needs to personalize the greeting and sign-off. */
export type PolishContext = {
  /** The signed-in agent's name — used to sign off the reply. */
  agentName: string;
  /** The customer's first name — used to open the greeting. */
  customerFirstName: string;
};

/**
 * Rewrites an agent's draft reply into a clearer, more polished version using
 * OpenAI `gpt-5-nano` via the Vercel AI SDK. Draft-only (the model sees just the
 * text, not the ticket thread), but personalized: it opens by greeting the
 * customer by first name and signs off with the agent's name. Nothing is
 * persisted — the route hands the result back to the composer, which replaces
 * the textarea with it.
 *
 * Throws if `OPENAI_API_KEY` isn't configured (the provider needs it) so the
 * route can surface a clean error, mirroring how `verifyWebhookSecret` guards a
 * missing `INBOUND_EMAIL_SECRET`.
 */
export async function polishReply(
  draft: string,
  { agentName, customerFirstName }: PolishContext,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    instructions:
      "You are a support agent's writing assistant. Rewrite the agent's draft reply " +
      "to a customer to improve clarity, correct grammar and spelling, and keep a " +
      "professional, friendly tone. " +
      `Open with a greeting that addresses the customer by their first name, "${customerFirstName}". ` +
      `Close with a sign-off on its own line using the agent's name, "${agentName}". ` +
      "If the draft already has a greeting or sign-off, replace it rather than duplicating it. " +
      "Preserve the original meaning and any facts, names, numbers, or links from the draft, " +
      "and don't invent content beyond the greeting and sign-off. " +
      "Return only the rewritten reply, with no preamble or explanation.",
    prompt: draft,
  });

  return text.trim();
}

/** One message in the thread the summary is generated from (oldest-first). */
export type TicketSummaryMessage = {
  /** Who sent it — the requester's email or an agent's email. */
  fromEmail: string;
  /** The message body. */
  body: string;
};

/**
 * Summarizes a ticket and its conversation history into a short brief an agent
 * can skim before jumping in, using OpenAI `gpt-5-nano` via the Vercel AI SDK.
 * The model sees the subject and the full thread (oldest-first) and returns a
 * few plain-text sentences: what the customer needs, what's happened, and where
 * things stand. Nothing is persisted — the route hands the result to the client,
 * which re-requests it on demand.
 *
 * Throws if `OPENAI_API_KEY` isn't configured, mirroring {@link polishReply}, so
 * the route can surface a clean error.
 */
export async function summarizeTicket(
  subject: string,
  messages: TicketSummaryMessage[],
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const transcript = messages
    .map((m) => `${m.fromEmail}:\n${m.body}`)
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    instructions:
      "You are a support assistant summarizing a customer support ticket for an " +
      "agent who is about to work it. Read the subject and the conversation thread " +
      "(oldest message first) and write a concise summary: what the customer needs, " +
      "what has happened so far, and the current state or any open question. " +
      "Keep it to a short paragraph or a few sentences of plain text — no headings, " +
      "no markdown, no preamble. Base it only on the thread; don't invent details.",
    prompt: `Subject: ${subject}\n\nConversation:\n${transcript}`,
  });

  return text.trim();
}

/** The AI's triage decision for a newly-arrived ticket. */
export type TicketTriage = {
  /** The classified category (always one of {@link TICKET_CATEGORIES}). */
  category: TicketCategory;
  /**
   * `true` only when the ticket can be fully answered from the knowledge base
   * *and* no KB escalation rule applies — the pipeline then auto-resolves it.
   */
  resolved: boolean;
  /** The KB-grounded customer reply when `resolved`; an empty string otherwise. */
  reply: string;
};

/**
 * Triages a newly-arrived ticket in a single structured call, using OpenAI
 * `gpt-5-nano` via the Vercel AI SDK. It both classifies the ticket into a
 * {@link TICKET_CATEGORIES} category and decides whether it can be fully resolved
 * from the provided knowledge base — if so, it drafts the customer reply. The
 * SDK's `Output.object` constrains the model to the exact shape (guaranteed-valid
 * category, boolean decision, reply text — no free-text parsing).
 *
 * The model must *decline* to resolve (`resolved: false`, `reply: ""`) whenever the
 * answer isn't fully covered by the KB or any of the KB's escalation rules apply
 * (legal threats, refunds outside the 30-day window, chargebacks/disputes,
 * account-security concerns, or low confidence) — those tickets go to a human.
 *
 * Throws if `OPENAI_API_KEY` isn't configured, mirroring {@link polishReply}, so
 * the caller can surface/log a clean error. The triage worker runs this off the
 * request path (see `server/src/lib/queue.ts`), so a throw only fails the job.
 */
export async function triageTicket(
  subject: string,
  body: string,
  knowledgeBase: string,
): Promise<TicketTriage> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { output } = await generateText({
    model: openai("gpt-5-nano"),
    output: Output.object({
      schema: z.object({
        category: z.enum([...TICKET_CATEGORIES]),
        resolved: z.boolean(),
        reply: z.string(),
      }),
    }),
    instructions:
      "You are a customer-support triage assistant. You are given a support " +
      "ticket and the official support knowledge base. Do two things.\n\n" +
      "1. Classify the ticket into exactly one category: " +
      `"${TICKET_CATEGORY.technical}" = product bugs, errors, how-to/setup issues; ` +
      `"${TICKET_CATEGORY.refund}" = refunds, billing, charges, cancellations; ` +
      `"${TICKET_CATEGORY.general}" = anything else.\n\n` +
      "2. Decide whether the ticket can be FULLY resolved using ONLY the knowledge " +
      "base. Set resolved=true ONLY IF the knowledge base clearly and completely " +
      "answers the customer's question. Set resolved=false (and reply=\"\") if the " +
      "answer isn't fully covered, if you're unsure, or if ANY of the knowledge " +
      "base's escalation rules apply (e.g. legal threats, refunds outside the " +
      "allowed window, chargebacks or payment disputes, account-security concerns). " +
      "When in doubt, do NOT resolve — leave it for a human agent.\n\n" +
      "When resolved=true, write `reply` as a complete, friendly answer to the " +
      "customer grounded ONLY in the knowledge base: greet them, answer using the " +
      "relevant policy/steps, and sign off as \"The Support Team\". Do not invent " +
      "policies, facts, or steps that aren't in the knowledge base.",
    prompt:
      `Knowledge base:\n${knowledgeBase}\n\n` +
      `----\n\nTicket subject: ${subject}\n\nTicket message:\n${body}`,
  });

  return output;
}
