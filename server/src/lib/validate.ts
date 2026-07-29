import type { Response } from "express";
import type { ZodType } from "zod";

/**
 * Validates `body` against `schema`. On success returns the typed, parsed data;
 * on failure sends `400 { error }` with the first issue's message and returns
 * `null`. Callers should `return` early when the result is `null`:
 *
 *   const data = parseBody(createUserSchema, req.body, res);
 *   if (!data) return;
 *
 * Centralizes the safeParse + first-issue-message response so routes don't
 * repeat it (see CLAUDE.md → "Validation (server)").
 */
export function parseBody<T>(
  schema: ZodType<T>,
  body: unknown,
  res: Response,
): T | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return null;
  }
  return parsed.data;
}
