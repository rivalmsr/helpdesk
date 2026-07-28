import { test, expect } from "@playwright/test";
import { login, ADMIN, AGENT } from "./helpers/auth";

/**
 * GET /api/users is guarded by requireRole("admin") (server/src/index.ts,
 * server/src/lib/authorize.ts). These hit it directly through the Vite proxy,
 * using `page.request` after a UI login so the request carries the same
 * session cookie the browser has.
 */
test.describe("GET /api/users authorization", () => {
  test("401 when unauthenticated", async ({ request }) => {
    const res = await request.get("/api/users");
    expect(res.status()).toBe(401);
  });

  test("403 for an agent session", async ({ page }) => {
    await login(page, AGENT);

    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(403);
  });

  test("200 for an admin session, including the seeded admin and agent", async ({ page }) => {
    await login(page, ADMIN);

    const res = await page.request.get("/api/users");
    expect(res.status()).toBe(200);

    const users = await res.json();
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: ADMIN.email, role: ADMIN.role }),
        expect.objectContaining({ email: AGENT.email, role: AGENT.role }),
      ]),
    );
  });

  test("each returned user has the expected shape", async ({ page }) => {
    await login(page, ADMIN);

    const res = await page.request.get("/api/users");
    const users = await res.json();

    expect(Array.isArray(users)).toBe(true);
    for (const user of users) {
      expect(user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String),
          role: expect.stringMatching(/^(admin|agent)$/),
        }),
      );
    }
  });
});
