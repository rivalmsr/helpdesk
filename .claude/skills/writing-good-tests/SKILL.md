---
name: writing-good-tests
description: Principles for writing maintainable, robust, and trustworthy unit, integration, and component tests. Use when adding or reviewing Vitest / React Testing Library specs (client/src/**/*.test.tsx), testing a component/function/module, or judging whether a test is well-written. Complements CLAUDE.md's "Testing (component)" mechanics (which cover happy-dom, bun run test, renderWithQueryClient, mocking axios). These principles also inform E2E, but the Playwright harness itself belongs to the e2e-test-writer subagent.
---

# Writing good tests

A good test is **maintainable**, **robust**, and **trustworthy**. Optimize for these three —
they matter more than coverage numbers. This skill is the *why/how*; the repo-specific wiring
lives in `CLAUDE.md` → "Testing (component)" (don't restate it, follow it).

## Maintainable — easy to read and change

- **Clear name that states the behavior**, not the mechanics: `it('closes when Escape is pressed')`,
  not `it('escape test')`. A reader should know what broke from the name alone.
- **One behavior per test.** If the name needs "and", split it. Separate the happy path, each
  boundary, and each error into their own `it`.
- **Small — aim for under ~10 lines of body.** Push repeated setup into helpers rather than
  inlining it: reuse `renderWithQueryClient` (`client/src/test/render.tsx`) and factor local
  helpers like `openAndFill` (see `CreateUserDialog.test.tsx`).
- **Clear, named fixtures/constants** (`const users = [...]`) instead of magic literals scattered
  through assertions.
- **Arrange → Act → Assert**, in that order, with the three visually distinct.

## Robust — survives refactors (test behavior, not implementation)

- **Assert on user-visible output, not internal wiring.** Test the *what*, not the *how*. Query
  the way a user perceives the UI: by role/label/text via RTL
  (`getByRole`, `getByLabelText`, `findByText`). Only fall back to `data-slot`/DOM selectors
  when there's genuinely no accessible handle (e.g. the dialog backdrop `[data-slot="dialog-overlay"]`).
- **Avoid over-tight assertions.** Assert the meaningful subset that proves the behavior, not an
  exact dump of a whole object or the exact number of calls when it's irrelevant. Tight
  assertions break on harmless refactors and erode trust.
- A behavior-preserving refactor (rename a prop, restructure JSX, swap an internal helper) should
  **not** turn a test red. If it does, the test was coupled to implementation.

## Trustworthy — no false positives or negatives

A trustworthy test fails only when the code is actually broken, and passes only when it actually
works.

- **Validate correct behavior *and* boundaries.** Cover the happy path plus empty/invalid/error
  paths (e.g. empty form → validation messages *and* no request fired; API rejects → error shown,
  dialog stays open).
- **Deterministic.** Same result every run:
  - No random data.
  - No dependence on the current date/time — fix the inputs. Mirror the component's own formatter
    and feed fixed ISO strings (see `UsersPage.test.tsx`'s `dateFormatter` +
    `'2026-01-15T10:00:00.000Z'`) so the assertion is locale/timezone-agnostic.
  - No dependence on ambient global state or external services — mock the boundary
    (`vi.mock('axios', …)`).
- **Isolated — each test independent, as if it's the only test in the world.**
  - Reset mocks in `beforeEach` (`mockReset()`); don't let one test's stubbing leak into the next.
  - Fresh state per render — `renderWithQueryClient` builds a new `QueryClient` each call; RTL
    `cleanup()` runs after each test (already wired in `client/src/test/setup.ts`).
  - No ordering assumptions and no shared mutable fixtures between tests.
- **Make sure the test can actually fail.** Guard against silent no-ops: assert the precondition
  before the thing you care about — e.g. open the dialog with `await screen.findByRole('dialog')`
  (which throws if it never opens) *before* asserting it closes. A test that can only pass proves
  nothing.

## In this repo

- **Mechanics live in `CLAUDE.md` → "Testing (component)"**: Vitest + RTL, `happy-dom` (not jsdom),
  run with `bun run test` (never bare `bun test`), `renderWithQueryClient` for TanStack Query
  components, mock network via `vi.mock('axios', …)`. Follow that; this skill doesn't repeat it.
- **Reference specs** (the canonical patterns to imitate):
  - `client/src/pages/UsersPage.test.tsx` — query states (loading/empty/error/loaded), deterministic
    date formatting, `data-slot` fallback for skeletons.
  - `client/src/components/CreateUserDialog.test.tsx` — form submit success, client-side validation
    blocking the request, server-error handling; `userEvent` interactions; `openAndFill` helper.
- **E2E is separate**: full-journey browser tests against the real client/server/DB go through the
  `e2e-test-writer` subagent, not here. These principles still apply to those specs.
