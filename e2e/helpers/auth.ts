import path from "node:path";
import dotenv from "dotenv";
import { expect, type Page } from "@playwright/test";

/**
 * Seeded test users, sourced from server/.env.test (the same file
 * e2e/global-setup.ts uses to seed the test database) so credentials never
 * drift from what's actually in the DB. Falls back to the documented
 * defaults from server/.env.test.example if the file is missing, purely so
 * this module doesn't throw at import time — global-setup already fails loud
 * with a clearer message if server/.env.test isn't set up.
 */
const testEnv =
  dotenv.config({
    path: path.resolve(__dirname, "..", "..", "server", ".env.test"),
  }).parsed ?? {};

export type TestUser = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "agent";
};

export const ADMIN: TestUser = {
  name: "Admin",
  email: testEnv.ADMIN_EMAIL ?? "admin@example.com",
  password: testEnv.ADMIN_PASSWORD ?? "password123",
  role: "admin",
};

export const AGENT: TestUser = {
  name: "Agent",
  email: testEnv.AGENT_EMAIL ?? "agent@example.com",
  password: testEnv.AGENT_PASSWORD ?? "password123",
  role: "agent",
};

/** Fills and submits the real login form, then waits for the redirect to "/". */
export async function login(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL("/");
}
