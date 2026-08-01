---
description: Write a commit message in Angular Conventional Commits style
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git commit:*), Bash(pbcopy:*)
argument-hint: [optional scope or context]
---

## Staged changes

!`git diff --cached`

## Recent commit style (for reference)

!`git log -10 --oneline`

## Instructions

Write a commit message for the staged changes above, following the **Angular Conventional Commits** convention.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 1. Type — pick exactly one

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semicolons, etc. — no code logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | A code change that improves performance |
| `test` | Adding or correcting tests |
| `build` | Changes to build system or external dependencies |
| `ci` | Changes to CI configuration/scripts |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Reverts a previous commit |

### 2. Scope

- The scope is the **feature, module, or area of the codebase** the change touches — not the file name.
- Look at the changed file paths and infer the logical area (e.g. changes under `src/users/` → scope `users`; changes to login form → scope `auth`).
- Lowercase, single word or short kebab-case (e.g. `users`, `auth`, `api-client`).
- Omit `(scope)` entirely only if the change is truly global/repo-wide (e.g. `chore: update dependencies`).

### 3. Subject line

- Format: `type(scope): subject`
- **Maximum 50 characters total** (including `type(scope): `). Count them — trim wording, don't abbreviate into gibberish.
- Imperative, present tense: "add", "fix", "change" — not "added", "fixes", "changed".
- No capital letter after the colon.
- No period at the end.

### 4. Body (optional — only if the change needs explaining)

- One blank line after the subject.
- Wrap lines at 72 characters.
- Explain *why*, not a restatement of the diff.
- Use `-` bullets for multiple points.

### 5. Footer (optional)

- `BREAKING CHANGE: <description>` if the commit introduces a breaking API change.
- `Closes #123` / `Refs #123` if there's an issue reference (check `$ARGUMENTS` for one).

### Do not

- Do not guess a scope that doesn't match the actual changed files.
- Do not write vague subjects like "update code" or "fix stuff".
- Do not add a body if the subject already says everything necessary.

### Output

1. Show the drafted commit message in a code block first.
2. Copy the exact commit message text to the clipboard by piping it to `pbcopy`, e.g.:
   ```bash
   printf '%s' "$COMMIT_MESSAGE" | pbcopy
   ```
   Use `printf '%s'` (not `echo`) so multi-line messages (subject + body + footer) are copied exactly, without an extra trailing newline issue. Confirm to the user that it's been copied.
3. Then ask whether to run `git commit -m "..."` with it directly, or let the user paste the copied message themselves — unless the user already confirmed to commit directly.

If `$ARGUMENTS` is provided, treat it as a hint for the scope or extra context (e.g. an issue number, or "scope: payments") and use it instead of guessing.
