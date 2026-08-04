import * as Sentry from "@sentry/bun";

/**
 * Sentry initialization — MUST run before any other module is imported, so it is
 * imported on the very first line of `src/index.ts` (`import "./instrument"`).
 *
 * Non-fatal by design: if `SENTRY_DSN` is unset the SDK simply stays disabled
 * (no events sent), so local dev and tests need no Sentry account. Set the DSN in
 * `server/.env` to turn error reporting on.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  // Send structured logs (console + Sentry.logger) to Sentry.
  enableLogs: true,
  // Error-focused: no performance tracing by default. Raise to sample traces.
  tracesSampleRate: 0,
});
