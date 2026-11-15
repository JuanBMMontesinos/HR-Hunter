# Guia de Testes Automatizados — HR Hunter (Playwright)

**Última Atualização:** 2026-11-15  
**Framework Unificado:** Playwright (`@playwright/test` + `@playwright/experimental-ct-react`)  

---

## 1. Arquitetura de Testes

O HR Hunter adota o **Playwright** como ferramenta única de testes automatizados em quatro camadas complementares:

| Projeto / Camada | Config | Diretório | Escopo Verificado |
|---|---|---|---|
| **Component Unit Tests** (`chromium`) | [`frontend/playwright-ct.config.ts`](../frontend/playwright-ct.config.ts) | `frontend/tests/ct/*.spec.tsx` | Isolamento de componentes React no Chromium real (renderização, props, eventos, classes do Design System, i18n, teclado, WCAG) |
| **Unit** (`unit`) | [`playwright.config.ts`](../playwright.config.ts) | `tests/unit/*.spec.ts` | Funções puras de domínio e utilitários (`dbMapper.js`, `errorCodes.js`, `passwordPolicy.js`, `tokenUtils.js`, `sanitizer.js`, `csvParser.js`, `queryHelpers.js`, `securityAlertService.js`, `securityAnalyticsService.js`, `auditService.js`, validadores Joi) |
| **API Integration** (`api`) | [`playwright.config.ts`](../playwright.config.ts) | `tests/api/*.spec.ts` | Endpoints Express (`/api/v1/health`, `/auth/*`, `/permissions/*`, `/security-alerts/*`, `/notifications/*`, `/exports/*`, `/analytics/*`, `/retention/*`, `/companies/*`, `/job-openings/*`, `/candidates/*`, `/processes/*`, `/users/*`, `/dashboard/*`, `/settings/*`, `/api/docs.json`) integrados ao Supabase PostgreSQL |
| **E2E** (`e2e`) | [`playwright.config.ts`](../playwright.config.ts) | `tests/e2e/*.spec.ts` | Fluxo completo no browser Chromium integrando Frontend Vite + Backend Express + Supabase |

---

## 2. Pré-requisitos de Browser (Chromium)

Por usar `@playwright/test` na raiz e `@playwright/experimental-ct-react` em `frontend/`, instale o Chromium nos dois contextos após `npm run install:all`:

```bash
npx playwright install chromium
npx --prefix frontend playwright install chromium
```

---

## 3. Comandos de Execução

```bash
# Todos os projetos da raiz (unit + api + e2e)
npm test

# Projetos individuais da raiz
npm run test:unit
npm run test:api
npm run test:e2e

# Testes unitários de componentes React (Playwright CT)
npm run test:ct

# Typecheck e build de produção do frontend
npm run typecheck:frontend
npm run build:frontend
```

---

## 4. Cobertura Atual (Fase 3 — Verificada)

- **Component Unit Tests (`npm run test:ct`) — 6/6 aprovados:**
  - `frontend/tests/ct/Button.spec.tsx` (3 testes): variantes `solid`/`ghost`/`neutral`, click handler, estado `disabled`, foco por teclado e altura mínima WCAG `44px`.
  - `frontend/tests/ct/StatusBadge.spec.tsx` (1 teste): variantes semânticas `success`, `warning`, `danger` e `neutral`.
  - `frontend/tests/ct/LanguageSwitcher.spec.tsx` (1 teste): alternância `PT-BR` ↔ `EN-US`, persistência em `localStorage` (`hr_hunter_lang`) e atualização de `document.documentElement.lang`.
  - `frontend/tests/ct/PageHeader.spec.tsx` (1 teste): landmark `banner`, título, subtítulo, slot de ações e `LanguageSwitcher`.
- **Root Suite (`npm test`) — 31/31 aprovados (`15` unit + `15` api + `1` e2e):**
  - `tests/unit/dbMapper.spec.ts` (4 testes): conversão `snake_case` → `camelCase` (incluindo dígitos como `last_24h`), mapeamento de coleções, normalização de strings vazias opcionais (`cpf`) e instâncias `Date` (ISO UTC ou `null`), e construção de `AppError`.
  - `tests/unit/auth.spec.ts` (3 testes): política de senha forte (`validatePasswordStrength`), assinatura/verificação JWT e hash SHA-256 determinístico (`tokenUtils`), proteção contra XSS e *CSV formula injection* (`sanitizer`).
  - `tests/unit/permissions.spec.ts` (4 testes): cálculo de risco `0..100` e classificação (`computeRiskScore`, `classifyRiskLevel`), recomendações automáticas (`buildRecommendations`), gatilhos de alerta (`evaluateAlertThresholds`: ≥5 usuário `HIGH`, ≥10 IP `CRITICAL`) e redação recursiva de segredos em `audit_log` (`redactSensitiveValues`).
  - `tests/unit/phase3-helpers.spec.ts` (4 testes): parser CSV com BOM UTF-8, delimitador `;` e aspas (`parseCsvText`), paginação e construtores SQL (`queryHelpers`), renderização de templates com escape XSS (`renderTemplate`), e normalização de `salaryMin`/`salaryMax` (`createJobOpeningSchema`).
  - `tests/api/health-and-schema.spec.ts` (3 testes): saúde da API + latência do Supabase (`GET /api/v1/health`), especificação OpenAPI (`GET /api/docs.json`) e verificação no Supabase das 7 migrations (`001`–`007`), 27 tabelas, 3 views, 8 funções, triggers e dados iniciais.
  - `tests/api/auth.spec.ts` (3 testes): login JWT + cookie `HttpOnly`, `/auth/me`, `/auth/permissions`, rotação de refresh token com detecção de replay e revogação no logout, bloqueio por 5 senhas incorretas (`423`) + `loginLimiter` na 6ª tentativa (`429`), e fluxo `forgot-password` / `reset-password` com validação de política.
  - `tests/api/permissions-and-security.spec.ts` (3 testes): gestão da matriz RBAC, proteção de `Admin` (`403`), invalidação de cache e registro `PERMISSION_CHANGE` em `audit_log`; escalação de ≥5 tentativas `403` para alerta `HIGH` + notificação a admins + resolução; exportações CSV (`UTF-8` com BOM + `;`) e PDF (`pdfkit`), geração de `SecurityReports` e execução de retenção de dados.
  - `tests/api/companies.spec.ts` (1 teste): criação, conflito de CNPJ único (`409`), paginação `limit <= 20`, estatísticas, atualização e bloqueio de soft delete com vaga ativa.
  - `tests/api/job-openings.spec.ts` (1 teste): aliases `salaryMin`/`salaryMax`, bloqueio de edição em vaga `Preenchida` (`409`), `/candidates`, `/analytics` e guarda de exclusão com processo ativo.
  - `tests/api/candidates.spec.ts` (1 teste): múltiplos candidatos com `cpf` nulo/vazio, sub-recursos (`experience`, `education`, `skills`) CRUD e importação CSV em lote (`POST /candidates/import`).
  - `tests/api/processes.spec.ts` (1 teste): visão Kanban, transição `/next-stage`, fluxo `/offer` → `Aceita` → `Contratado` (`Concluído`), `/reject` e `/timeline`.
  - `tests/api/users.spec.ts` (1 teste): CRUD restrito ao perfil `Admin`, atualização restrita de autoperfil, `/activity`, `/reset-password` e soft delete.
  - `tests/api/dashboard-and-settings.spec.ts` (1 teste): `/dashboard/kpis`, `/analytics`, `/critical-processes`, mascaramento `is_sensitive` em `/settings`, CRUD de etapas/funis/templates com sanitização XSS, proteção `is_system` (`403`), `/audit-log`, `/login-history` e `/backup`.
  - `tests/e2e/smoke.spec.ts` (1 teste): carregamento da UI em `http://localhost:5173`, badge vivo `Supabase Conectado` e troca dinâmica `PT-BR` ↔ `EN-US`.

**Total consolidado na Fase 3:** `37/37` testes Playwright aprovados (`0` falhas, `0` pulados).

---

## 5. Regras de Governança de Testes

1. **Sem credenciais hardcoded:** configurações de conexão vêm exclusivamente do `.env` local (gitignored).
2. **Sem mocks falsos de banco nos testes `api` e `e2e`:** validações de integração executam roundtrips reais contra o Supabase PostgreSQL.
3. **Sem `test.skip` ou afrouxamento de asserções:** todo teste adicionado ou alterado deve passar integralmente após a edição final antes do commit.
4. **Higiene de dados (Fases F2+):** registros criados por testes de escrita deverão usar prefixos únicos e limpeza obrigatória em `test.afterEach` / `test.afterAll`.
