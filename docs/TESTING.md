# Guia de Testes Automatizados — HR Hunter (Playwright)

**Última Atualização:** 2026-11-15  
**Framework Unificado:** Playwright (`@playwright/test` + `@playwright/experimental-ct-react`)  

---

## 1. Arquitetura de Testes

O HR Hunter adota o **Playwright** como ferramenta única de testes automatizados em quatro camadas complementares:

| Projeto / Camada | Config | Diretório | Escopo Verificado |
|---|---|---|---|
| **Component Unit Tests** (`chromium`) | [`frontend/playwright-ct.config.ts`](../frontend/playwright-ct.config.ts) | `frontend/tests/ct/*.spec.tsx` | Isolamento de componentes React no Chromium real (renderização, props, eventos, classes do Design System, i18n, teclado, WCAG) |
| **Unit** (`unit`) | [`playwright.config.ts`](../playwright.config.ts) | `tests/unit/*.spec.ts` | Funções puras de domínio e utilitários (`dbMapper.js`, `errorCodes.js`, normalizações) |
| **API Integration** (`api`) | [`playwright.config.ts`](../playwright.config.ts) | `tests/api/*.spec.ts` | Endpoints Express (`/api/v1/health`, `/api/docs.json`) e invariantes reais do schema no Supabase PostgreSQL |
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

## 4. Cobertura Atual (Fase 1 — Verificada)

- **Component Unit Tests (`npm run test:ct`) — 6/6 aprovados:**
  - `frontend/tests/ct/Button.spec.tsx` (3 testes): variantes `solid`/`ghost`/`neutral`, click handler, estado `disabled`, foco por teclado e altura mínima WCAG `44px`.
  - `frontend/tests/ct/StatusBadge.spec.tsx` (1 teste): variantes semânticas `success`, `warning`, `danger` e `neutral`.
  - `frontend/tests/ct/LanguageSwitcher.spec.tsx` (1 teste): alternância `PT-BR` ↔ `EN-US`, persistência em `localStorage` (`hr_hunter_lang`) e atualização de `document.documentElement.lang`.
  - `frontend/tests/ct/PageHeader.spec.tsx` (1 teste): landmark `banner`, título, subtítulo, slot de ações e `LanguageSwitcher`.
- **Root Suite (`npm test`) — 8/8 aprovados:**
  - `tests/unit/dbMapper.spec.ts` (4 testes): conversão `snake_case` → `camelCase`, mapeamento de coleções, normalização de strings vazias opcionais (`cpf`) para `null` e construção de `AppError`.
  - `tests/api/health-and-schema.spec.ts` (3 testes): saúde da API + latência do Supabase (`GET /api/v1/health`), especificação OpenAPI (`GET /api/docs.json`) e verificação no Supabase das 7 migrations (`001`–`007`), `users`, `permissions` (28), múltiplos candidatos com `cpf IS NULL`, `fn_get_dashboard_kpis()` e `fn_get_critical_processes()`.
  - `tests/e2e/smoke.spec.ts` (1 teste): carregamento da UI em `http://localhost:5173`, badge vivo `Supabase Conectado` e troca dinâmica `PT-BR` ↔ `EN-US`.

**Total consolidado na Fase 1:** `14/14` testes Playwright aprovados (`0` falhas, `0` pulados).

---

## 5. Regras de Governança de Testes

1. **Sem credenciais hardcoded:** configurações de conexão vêm exclusivamente do `.env` local (gitignored).
2. **Sem mocks falsos de banco nos testes `api` e `e2e`:** validações de integração executam roundtrips reais contra o Supabase PostgreSQL.
3. **Sem `test.skip` ou afrouxamento de asserções:** todo teste adicionado ou alterado deve passar integralmente após a edição final antes do commit.
4. **Higiene de dados (Fases F2+):** registros criados por testes de escrita deverão usar prefixos únicos e limpeza obrigatória em `test.afterEach` / `test.afterAll`.
