import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
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

/**
 * Classifies a ticket into one of the {@link TICKET_CATEGORIES} from its subject
 * and first message, using OpenAI `gpt-5-nano` via the Vercel AI SDK. Uses the
 * SDK's `Output.choice` so the result is guaranteed to be a valid category (the
 * model is constrained to the option list — no free-text parsing needed).
 *
 * Throws if `OPENAI_API_KEY` isn't configured, mirroring {@link polishReply}, so
 * the caller can surface/log a clean error. The inbound-email route runs this
 * fire-and-forget after responding, so a throw never affects the webhook.
 */
export async function classifyTicket(
  subject: string,
  body: string,
): Promise<TicketCategory> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { output } = await generateText({
    model: openai("gpt-5-nano"),
    output: Output.choice({ options: [...TICKET_CATEGORIES] }),
    prompt:
      "Classify this support ticket into exactly one category. " +
      `"${TICKET_CATEGORY.technical}" = product bugs, errors, how-to/setup issues; ` +
      `"${TICKET_CATEGORY.refund}" = refunds, billing, charges, cancellations; ` +
      `"${TICKET_CATEGORY.general}" = anything else.\n\n` +
      `Subject: ${subject}\n\nMessage:\n${body}`,
  });

  return output;
}
