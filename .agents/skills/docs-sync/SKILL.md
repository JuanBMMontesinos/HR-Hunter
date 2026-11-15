---
name: docs-sync
description: >-
  Enforces strict synchronization between HR Hunter source code, Supabase
  migrations, Playwright tests, and all project documentation. Activate on every
  task that adds, modifies, or removes features, endpoints, database objects,
  environment variables, UI flows, or tests so documentation never becomes
  outdated.
---

# Continuous Documentation Sync — HR Hunter

**Rule:** Documentation MUST ALWAYS reflect the exact, verified state of the project. Never leave docs outdated after any code, schema, config, or test change.

## Documentation Map (Single Source of Truth)

| What Changed | Documents to Update |
|---|---|
| Project phases, roadmap, architecture decisions | `docs/PLANO_MESTRE.md`, `CHANGELOG.md` |
| Folder layout, dependencies, quick start, scripts | `README.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md` |
| Environment variables (`.env.example`) | `docs/SETUP.md`, `.env.example` |
| Supabase migrations, tables, indexes, triggers, RPCs/functions, seed data | `docs/DATABASE.md`, `docs/DATA_MAPPING.md` |
| Express routes, controllers, Joi/Zod schemas, status codes, RBAC roles | `docs/API.md`, backend Swagger/OpenAPI annotations (`/api/docs`) |
| Auth, JWT, permissions matrix, alerts, retention, security headers | `docs/SECURITY_AND_PERMISSIONS.md`, `docs/ARCHITECTURE.md` |
| Frontend pages, components, design tokens, i18n keys (`pt-BR`/`en-US`) | `docs/ARCHITECTURE.md`, `docs/I18N.md` (if present), `CHANGELOG.md` |
| Playwright unit/component, API, or E2E suites & commands | `docs/TESTING.md` |

## Mandatory Workflow

1. **Before Finishing Any Implementation Task:**
   - Review `git diff` / changed files to list every modified endpoint, table, migration, env var, UI route, and Playwright test file.
   - Update all affected markdown files and Swagger specs in the **same commit** as the implementation.
2. **Ground Truth Only:**
   - Only document file paths, table/column names, endpoint URLs, env vars, and test results that actually exist and were verified in the current workspace.
   - Never document planned/unimplemented endpoints or features as "completed" — mark roadmap items accurately (`[ ]` vs `[x]`).
3. **Changelog Discipline:**
   - Add an entry in `CHANGELOG.md` under `[Unreleased]` (or current milestone) describing Added, Changed, Fixed, and Removed items.
4. **Validation Before Commit:**
   - Verify all relative markdown links inside `README.md` and `docs/*.md` point to real files.
   - Run this check before invoking the `git-commit-push` skill.
