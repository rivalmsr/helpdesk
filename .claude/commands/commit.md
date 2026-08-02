---
description: Write a commit message in Angular Conventional Commits style
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(pbcopy:*)
argument-hint: [optional scope or context]
---

## Staged changes

!`git diff --cached`

## Recent commit style (for reference)

!`git log -10 --oneline`

## Instructions

Write a **single subject line** for the staged changes above, following the **Angular Conventional Commits** convention. Do NOT write a body or footer — subject line only.

### Format

```
<type>(<scope>): <subject>
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

### Do not

- Do not write a body or footer — only the subject line.
- Do not guess a scope that doesn't match the actual changed files.
- Do not write vague subjects like "update code" or "fix stuff".

### Output

1. Show the drafted subject line in a code block.
2. Copy it to the clipboard with `printf '%s' "<subject>" | pbcopy` and confirm it's copied.
3. Stop. Do not ask any follow-up questions and do not run `git commit`.

If `$ARGUMENTS` is provided, treat it as a hint for the scope or extra context (e.g. an issue number, or "scope: payments") and use it instead of guessing.
