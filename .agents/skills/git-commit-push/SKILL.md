---
name: git-commit-push
description: >-
  Standardizes safe Git staging, commit formatting, secret scanning checks, and
  pushing source code to https://github.com/JuanBMMontesinos/HR-Hunter. Activate
  whenever completing a feature, fix, migration, test update, or documentation
  change that should be committed and pushed to GitHub.
---

# Git Commit & Push Workflow — HR Hunter

Target remote repository: `https://github.com/JuanBMMontesinos/HR-Hunter`

## Pre-Flight Checklist (Mandatory Before Every Commit)

1. **Verify Remote & Branch:**
   ```bash
   git remote -v
   git branch --show-current
   ```
   Confirm `origin` points to `https://github.com/JuanBMMontesinos/HR-Hunter.git` (or SSH equivalent).

2. **Secret & Credential Guard (CRITICAL):**
   - Verify `.env`, `.env.local`, `.env.test`, `*.pem`, and `*.key` are ignored by `.gitignore` and NEVER appear in `git status` or `git diff --cached`.
   - Scan staged diffs before committing to guarantee no Supabase DB passwords, `DATABASE_URL` credentials, `SUPABASE_SERVICE_ROLE_KEY`, SMTP passwords, or `JWT_SECRET` values are included:
     ```bash
     git status --short
     git diff --cached
     ```
   - If any secret is staged, run `git reset HEAD <file>` and sanitize immediately.

3. **Quality & Documentation Gates:**
   - Ensure the build/typecheck passes for modified workspaces (`frontend` / `backend`).
   - Ensure Playwright tests pass (follow `playwright-unit-testing` skill).
   - Ensure all documentation is updated to reflect the changes (follow `docs-sync` skill).

## Commit & Push Steps

1. Stage intended changes cleanly:
   ```bash
   git add -A
   git status
   ```
2. Create an atomic commit using Conventional Commits:
   - `feat(scope): ...` for new features
   - `fix(scope): ...` for bug fixes
   - `db(migrations): ...` for Supabase SQL migrations/seeds
   - `test(playwright): ...` for Playwright unit/component/API/E2E tests
   - `docs(scope): ...` for documentation updates
   - `chore(scope): ...` or `ci(scope): ...` for tooling/workflows
   ```bash
   git commit -m "feat(scope): clear summary of change"
   ```
3. Push to the remote repository:
   ```bash
   git push -u origin <current-branch>
   ```

## Post-Push Verification

```bash
git status
git log -1 --oneline
```
Confirm working tree is clean and the latest commit hash matches `origin/<current-branch>`.
