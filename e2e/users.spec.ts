import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { login, ADMIN, AGENT } from "./helpers/auth";

/** Unique, parallel-safe user data so specs never collide on email. */
function newUserData() {
  const unique = randomUUID();
  return {
    name: `E2E User ${unique.slice(0, 8)}`,
    email: `e2e-${unique}@example.com`,
    password: "password123",
  };
}

/**
 * Creates a user directly via the API (as the already-logged-in admin, whose
 * session cookie `request` shares with `page`) so update/delete specs own a
 * user they created rather than mutating a shared seeded one.
 */
async function createUser(
  request: APIRequestContext,
  data: { name: string; email: string; password: string },
) {
  const res = await request.post("/api/users", { data });
  return res.json() as Promise<{ id: string; name: string; email: string }>;
}

test.describe("User management (/users)", () => {
  test("admin sees the seeded users listed in the table", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/users");

    const table = page.getByRole("table");
    await expect(table.getByRole("row").filter({ hasText: ADMIN.email })).toBeVisible();
    await expect(table.getByRole("row").filter({ hasText: AGENT.email })).toBeVisible();
  });

  test("admin creates a user and it appears in the table", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/users");
    const { name, email, password } = newUserData();

    await page.getByRole("button", { name: "New user" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create user" }).click();

    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name, exact: true })).toBeVisible();
  });

  test("admin edits a user's name and the change appears in the table", async ({ page }) => {
    await login(page, ADMIN);
    const original = newUserData();
    const user = await createUser(page.request, original);

    await page.goto("/users");
    const row = page.getByRole("row").filter({ hasText: original.email });
    await row.getByRole("button", { name: `Edit ${user.name}` }).click();

    const updatedName = `${original.name} Updated`;
    await page.getByLabel("Name").fill(updatedName);
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(row.getByRole("cell", { name: updatedName, exact: true })).toBeVisible();
  });

  test("admin deletes a user and it disappears from the table", async ({ page }) => {
    await login(page, ADMIN);
    const data = newUserData();
    const user = await createUser(page.request, data);

    await page.goto("/users");
    const row = page.getByRole("row").filter({ hasText: data.email });
    await row.getByRole("button", { name: `Delete ${user.name}` }).click();

    const confirmDialog = page.getByRole("dialog", { name: "Delete user" });
    await confirmDialog.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.getByRole("row").filter({ hasText: data.email })).toHaveCount(0);
  });
});
