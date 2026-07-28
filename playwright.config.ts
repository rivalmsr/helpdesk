import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// The test environment lives in server/.env.test (separate database, seed
// credentials). We read DATABASE_URL from it here and inject it into the server
// web server below, so E2E runs never touch the development database.
const testEnv =
  dotenv.config({ path: path.resolve(__dirname, "server/.env.test") }).parsed ??
  {};

const TEST_DATABASE_URL = testEnv.DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL in server/.env.test — copy server/.env.test.example and point it at a dedicated test database.",
  );
}

const CLIENT_URL = "http://localhost:5173";
const SERVER_HEALTH_URL = "http://localhost:3001/api/health";

export default defineConfig({
  testDir: "./e2e",
  // Ignore the setup helper so it isn't picked up as a spec.
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  // Migrates + seeds the test database once before any tests run.
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: CLIENT_URL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Boot the real app (client + server) against the test database. The server
  // inherits its auth config (BETTER_AUTH_*, origins) from server/.env via Bun's
  // automatic env loading; we override only DATABASE_URL so it targets the test
  // DB. reuseExistingServer is off so a running `bun dev` (dev database) is never
  // silently reused for tests — stop it before running E2E.
  webServer: [
    {
      command: "bun --filter server dev",
      url: SERVER_HEALTH_URL,
      cwd: __dirname,
      timeout: 120 * 1000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: TEST_DATABASE_URL,
      },
    },
    {
      command: "bun --filter client dev",
      url: CLIENT_URL,
      cwd: __dirname,
      timeout: 120 * 1000,
      reuseExistingServer: false,
    },
  ],
});
