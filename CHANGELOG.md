# Changelog

Todas as mudanças notáveis do projeto **HR Hunter** serão documentadas neste arquivo.

## [Unreleased]

### Added — Fase F1 (Fundação Monorepo, Supabase, Express/React & Playwright)
- **Workspace & Scripts (`package.json`, `backend/`, `frontend/`):**
  - Estrutura multi-pacote configurada com scripts unificados para instalação (`install:all`), migrations/seed (`migrate`, `seed`, `db:setup`), dev servers (`dev:backend`, `dev:frontend`), build (`typecheck:frontend`, `build:frontend`) e testes Playwright (`test`, `test:unit`, `test:api`, `test:e2e`, `test:ct`).
- **Banco de Dados Supabase (`database/migrations/001`–`007` + `database/scripts/`):**
  - Migrations SQL idempotentes aplicadas diretamente no Supabase PostgreSQL (`fhhgtjzwmhgdiokqqebg`): **27 tabelas** em `snake_case`, índice único parcial em `candidates.cpf`, **3 views** (`vw_job_opening_summary`, `vw_candidate_summary`, `vw_recruitment_metrics`), **17 triggers** e **8 funções PL/pgSQL**.
  - Seed inicial idempotente executado (`database/scripts/seed.js`) populando funis, etapas, 28 permissões, matriz de roles, templates, configurações, 5 usuários, empresas, vagas, candidatos, processos e logs (zero tabelas de domínio/configuração vazias).
- **Backend Fundação (`backend/`):**
  - App Express modular (`app.js` / `server.js`) com `helmet`, CORS restritivo, rate limiters (`apiLimiter` / `loginLimiter`), logger Winston, tratamento padronizado de erros (`ErrorCodes` + `AppError`), `dbMapper.js` (`snake_case` ↔ `camelCase`), Swagger/OpenAPI (`/api/docs`, `/api/docs.json`) e endpoint vivo `GET /api/v1/health`.
- **Frontend Fundação (`frontend/`):**
  - Aplicação React 18 + Vite + TypeScript utilizando tokens de `design-system.json` (`variables.css`, CSS `@layer` em `globals.css`, WCAG 2.1 AA, foco visível `#3C7EFF`, alvos mínimos `44px`, skip link, `prefers-reduced-motion`).
  - Componentes comuns (`Button`, `StatusBadge`, `LanguageSwitcher`, `PageHeader`), cliente `api.ts`, internacionalização `pt-BR`/`en-US` e tela inicial com verificação em tempo real da saúde da API + Supabase.
- **Testes Playwright (`14/14` aprovados):**
  - `frontend/tests/ct/`: 6 testes unitários de componentes (`Button`, `StatusBadge`, `LanguageSwitcher`, `PageHeader`).
  - `tests/unit/dbMapper.spec.ts`: 4 testes unitários de mapeamento e códigos de erro.
  - `tests/api/health-and-schema.spec.ts`: 3 testes de integração contra Express e schema real do Supabase.
  - `tests/e2e/smoke.spec.ts`: 1 teste E2E completo em Chromium validando `Supabase Conectado` e alternância dinâmica `PT-BR` ↔ `EN-US`.
- **Documentação Sincronizada (`docs/`):**
  - Criados `docs/DATABASE.md`, `docs/DATA_MAPPING.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md` e `docs/TESTING.md`; atualizados `docs/PLANO_MESTRE.md`, `README.md` e `CHANGELOG.md`.

### Fixed
- **`backend/config/swagger.js`:** Normalização de separadores de caminho POSIX (`.replace(/\\/g, '/')`) na opção `apis` do `swagger-jsdoc` para garantir descoberta das anotações `@openapi` no Windows.

### Added — Fase F0 (Planejamento & Governança)
- **Planejamento v2.0 (`docs/PLANO_MESTRE.md`):** Novo plano mestre migrando a especificação original (MSSQL/Cypress) para **Supabase (PostgreSQL)**, **Playwright** e governança contínua.
- **Skills do Workspace (`.agents/skills/`):**
  - `playwright-unit-testing` — Padrão de testes unitários de componentes, unit/API e E2E com Playwright.
  - `git-commit-push` — Fluxo seguro de commit e push para `https://github.com/JuanBMMontesinos/HR-Hunter`.
  - `docs-sync` — Regra contínua de sincronização entre código, schema e documentação.
- **Fundação do Repositório:** `.gitignore` (protegendo `.env`), `.env.example`, `design-system.json` e `README.md`.
- **Prompt Atualizado (`../PRDs/HR_Hunter_AI_Prompts_Supabase.md`):** Prompt completo v2.0 adaptado para Supabase PostgreSQL (migrations aplicadas pela IA via conexão direta ou MCP), Playwright e skills obrigatórias.
