import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Guards the inbound-email webhook. A mail provider (or a `curl` test) posts
 * with no Better Auth session cookie, so the cookie-based `requireRole`
 * middleware can't apply — instead we authenticate the caller with a shared
 * secret sent in the `X-Webhook-Secret` header and compared, in constant time,
 * against `INBOUND_EMAIL_SECRET`. Responds `401 { error }` on any mismatch or
 * when the secret isn't configured, mirroring the app-wide error shape.
 */
export function verifyWebhookSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expected = process.env.INBOUND_EMAIL_SECRET;
  const provided = req.header("x-webhook-secret");

  if (!expected || !provided || !safeEqual(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

/** Constant-time string compare; guards unequal lengths (timingSafeEqual throws on those). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
