import { test, expect } from "@playwright/test";
import { login, ADMIN, AGENT } from "./helpers/auth";

test.describe("Sign in", () => {
  test("admin with valid credentials lands on the home page", async ({ page }) => {
    await login(page, ADMIN);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Helpdesk" })).toBeVisible();
  });

  test("agent with valid credentials lands on the home page", async ({ page }) => {
    await login(page, AGENT);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Helpdesk" })).toBeVisible();
  });

  test("wrong password is rejected and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/login");
    // The form is still there, i.e. we never navigated away.
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("unknown email is rejected and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("no-such-user@example.com");
    await page.getByLabel("Password").fill("whatever-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Route protection & redirects", () => {
  test("unauthenticated visit to / redirects to the login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated visit to /users redirects to the login page", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/login");
  });

  test("authenticated visit to /login redirects to the home page", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });

  test("authenticated visit to an unknown path redirects to the home page", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/nope");
    await expect(page).toHaveURL("/");
  });

  test("unauthenticated visit to an unknown path redirects to the login page", async ({ page }) => {
    await page.goto("/nope");
    // "*" -> "/" first, then the "/" route itself bounces to "/login" since
    // there's no session.
    await expect(page).toHaveURL("/login");
  });

  test("admin can open the admin-only /users page", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/users");

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("agent is redirected away from the admin-only /users page", async ({ page }) => {
    await login(page, AGENT);
    await page.goto("/users");

    await expect(page).toHaveURL("/");
  });
});

test.describe("Session lifecycle", () => {
  test("session survives a full page reload", async ({ page }) => {
    await login(page, ADMIN);

    await page.reload();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation").getByText(ADMIN.name, { exact: true })).toBeVisible();
  });

  test("signing out clears the session and returns to the login page", async ({ page }) => {
    await login(page, ADMIN);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");

    // The cleared session is enforced server-side too, not just by the
    // client-side redirect that just happened.
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Sign-up disabled", () => {
  test("/register and /signup redirect like any unknown path", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL("/login");

    await page.goto("/signup");
    await expect(page).toHaveURL("/login");
  });
});
