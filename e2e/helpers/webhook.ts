import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import type { APIRequestContext } from "@playwright/test";

/**
 * Shared secret for the inbound-email webhook, sourced from server/.env.test
 * (same file e2e/global-setup.ts and helpers/auth.ts read) so it never drifts
 * from what the running server actually checks against. Falls back to the
 * documented default from server/.env.test.example purely so this module
 * doesn't throw at import time.
 */
const testEnv =
  dotenv.config({
    path: path.resolve(__dirname, "..", "..", "server", ".env.test"),
  }).parsed ?? {};

export const INBOUND_EMAIL_SECRET =
  testEnv.INBOUND_EMAIL_SECRET ?? "test-inbound-secret";

/** A globally-unique `Message-Id`-style header value, so parallel specs never collide on dedupe/threading. */
export function uniqueMessageId(): string {
  return `<${randomUUID()}@e2e.test>`;
}

export type InboundEmailPayload = {
  from: string;
  subject?: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
};

/** POSTs to the inbound-email webhook with the shared-secret header already attached. */
export function postInboundEmail(
  requestContext: APIRequestContext,
  payload: InboundEmailPayload,
  secret: string = INBOUND_EMAIL_SECRET,
) {
  return requestContext.post("/api/inbound-email", {
    data: payload,
    headers: { "X-Webhook-Secret": secret },
  });
}
