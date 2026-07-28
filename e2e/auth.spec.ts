import { test, expect } from "@playwright/test";
import { login, ADMIN, AGENT } from "./helpers/auth";

test.describe("Login page", () => {
  test("renders the login form for an unauthenticated visitor", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("admin login succeeds and lands on the home page", async ({ page }) => {
    await login(page, ADMIN);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Helpdesk" })).toBeVisible();
  });

  test("agent login succeeds and lands on the home page", async ({ page }) => {
    await login(page, AGENT);

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Helpdesk" })).toBeVisible();
  });

  test("wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/login");
    // The form is still there, i.e. we never navigated away.
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("unknown email shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("no-such-user@example.com");
    await page.getByLabel("Password").fill("whatever-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test.describe("client-side validation", () => {
    test("invalid email format shows a validation error and blocks submission", async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill("not-an-email");
      await page.getByLabel("Password").fill("some-password");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("Enter a valid email address")).toBeVisible();
      await expect(page.getByText("Password is required")).not.toBeVisible();
      await expect(page).toHaveURL("/login");
    });

    test("empty password is rejected", async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(ADMIN.email);
      // Leave password blank.
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("Password is required")).toBeVisible();
      await expect(page.getByText("Enter a valid email address")).not.toBeVisible();
      await expect(page).toHaveURL("/login");
    });

    test("empty form shows both field errors", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("Enter a valid email address")).toBeVisible();
      await expect(page.getByText("Password is required")).toBeVisible();
      await expect(page).toHaveURL("/login");
    });
  });
});

test.describe("Route protection & redirects", () => {
  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated visit to /users redirects to /login", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/login");
  });

  test("authenticated visit to /login redirects to /", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });

  test("unknown path redirects to / (authenticated)", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/nope");
    await expect(page).toHaveURL("/");
  });

  test("unknown path ultimately redirects to /login (unauthenticated)", async ({ page }) => {
    await page.goto("/nope");
    // "*" -> "/" first, then the "/" route itself bounces to "/login" since
    // there's no session.
    await expect(page).toHaveURL("/login");
  });

  test("/users is admin-only: admin can view it", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/users");

    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("/users is admin-only: agent is redirected to /", async ({ page }) => {
    await login(page, AGENT);
    await page.goto("/users");

    await expect(page).toHaveURL("/");
  });
});

test.describe("NavBar / role UI", () => {
  test("admin sees the Users link and their name", async ({ page }) => {
    await login(page, ADMIN);

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(nav.getByText(ADMIN.name, { exact: true })).toBeVisible();
  });

  test("agent does not see the Users link, but sees their name", async ({ page }) => {
    await login(page, AGENT);

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(nav.getByText(AGENT.name, { exact: true })).toBeVisible();
  });
});

test.describe("Session lifecycle", () => {
  test("session persists across a page reload", async ({ page }) => {
    await login(page, ADMIN);

    await page.reload();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation").getByText(ADMIN.name, { exact: true })).toBeVisible();
  });

  test("logout clears the session and returns to /login", async ({ page }) => {
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
  test("login page exposes no sign-up / register link", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: /sign up|register/i })).toHaveCount(0);
  });

  test("/register and /signup are not routes; both redirect like any unknown path", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL("/login");

    await page.goto("/signup");
    await expect(page).toHaveURL("/login");
  });
});
