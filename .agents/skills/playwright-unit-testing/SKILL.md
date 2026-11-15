---
name: playwright-unit-testing
description: >-
  Guides writing, structuring, running, and verifying unit, component, API, and
  E2E tests using Playwright for HR Hunter. Activate whenever creating or
  modifying components, services, API endpoints, database queries, or user flows,
  or before committing and pushing code.
---

# Playwright Testing Standard — HR Hunter

HR Hunter uses **Playwright** as the unified automated test framework across frontend components, backend/domain logic, API contracts, and end-to-end flows.

## Test Layers & Structure

1. **Component Unit Tests (`frontend/tests/ct/**/*.spec.tsx`)**
   - Uses `@playwright/experimental-ct-react` with `frontend/playwright-ct.config.ts`.
   - Tests individual UI components in isolation inside real headless Chromium:
     - Common UI (`Button`, `Input`, `DataTable`, `FilterBar`, `PageHeader`, `StatusBadge`, `Modal`, `Toast`)
     - Auth & RBAC (`RoleProtectedRoute`, `LoginForm`, `PermissionsManager`)
     - Domain Views (`KPICard`, `JobDetailsModal`, `ProcessKanban`, `CandidateForm`)
   - Validates rendering, props, state transitions, form validation, i18n (`pt-BR` / `en-US`), keyboard navigation, and accessibility (`role`, `aria-*`).

2. **Unit & API Integration Tests (`tests/unit/**/*.spec.ts`, `tests/api/**/*.spec.ts`)**
   - Uses `@playwright/test` (`playwright.config.ts`).
   - **Unit specs (`tests/unit/`):** Test pure domain logic (validators, formatters, CPF/CNPJ normalization, salary/stage transitions, risk scoring, i18n stage slug translation, JWT/password helpers) using Playwright's `test` and `expect`.
   - **API integration specs (`tests/api/`):** Use Playwright's `request` (`APIRequestContext`) against the Express API connected to Supabase PostgreSQL (real database roundtrips, zero fake DB mocks for integration):
     - Auth (login, refresh token, rate limit, lockout, logout, password reset)
     - RBAC & granular permissions matrix (`403` enforcement + audit log)
     - CRUDs (Companies, Job Openings, Candidates with nullable CPF, Processes/Kanban, Users, Settings)
     - Dashboard KPIs, Analytics, and Critical Processes

3. **E2E Critical Flow Tests (`tests/e2e/**/*.spec.ts`)**
   - Uses `@playwright/test` across full Frontend + Backend + Supabase stack:
     - Authentication & permission-gated navigation
     - Creating company → creating job opening → creating candidate → moving candidate through Kanban funnel to Offer/Hired
     - Filtering, pagination, language switching (`pt-BR` ↔ `en-US`), and settings/permissions changes

## Mandatory Rules

1. **Test on Every Change:** Every new feature, bug fix, component, or endpoint must include or update its corresponding Playwright test(s) in the same task.
2. **No Hardcoded Secrets:** Never hardcode real DB passwords, service role keys, or production JWT secrets in test files. Load test config from `.env` / `.env.test` (gitignored) or generate ephemeral test tokens/users.
3. **Database Hygiene:** API and E2E tests running against Supabase must isolate records with unique prefixes/timestamps and clean up created test rows in `test.afterEach` / `test.afterAll` hooks.
4. **Zero Relaxed Assertions:** Never skip failing tests (`test.skip`) or weaken assertions just to pass CI.

## Commands & Verification

```bash
# Run Frontend Component Unit Tests (Playwright CT)
cd frontend && npx playwright test -c playwright-ct.config.ts

# Run Unit, API, and E2E Playwright Suites
npx playwright test

# Run a specific suite or file
npx playwright test tests/unit
npx playwright test tests/api
npx playwright test tests/e2e
```

## Success Criteria

- All executed Playwright suites finish with exit code `0` and 0 failed tests.
- When test suites, commands, or counts change, update `docs/TESTING.md` (see `docs-sync` skill) before running `git-commit-push`.
