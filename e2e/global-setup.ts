import { execSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Global setup: prepare the separate test database before any E2E tests run.
 *
 * Reads server/.env.test, then runs Prisma migrations and the seed script with
 * that DATABASE_URL. `prisma migrate deploy` creates the database if it doesn't
 * yet exist, so a fresh checkout only needs Postgres running and a valid
 * connection string in server/.env.test.
 */
export default async function globalSetup() {
  const serverDir = path.resolve(__dirname, "..", "server");

  const parsed = dotenv.config({
    path: path.join(serverDir, ".env.test"),
  }).parsed;

  if (!parsed?.DATABASE_URL) {
    throw new Error(
      "Missing DATABASE_URL in server/.env.test — copy server/.env.test.example and point it at a dedicated test database.",
    );
  }

  // Let .env.test drive this step: its DATABASE_URL + seed credentials take
  // precedence over anything in server/.env (dotenv/config won't override
  // values already present in the child process env).
  const env = { ...process.env, ...parsed };

  console.log("[e2e] Applying migrations to the test database…");
  execSync("bun x prisma migrate deploy", {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });

  console.log("[e2e] Seeding the test database…");
  execSync("bun prisma/seed.ts", {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });
}
