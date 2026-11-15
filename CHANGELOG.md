# Changelog

Todas as mudanças notáveis do projeto **HR Hunter** serão documentadas neste arquivo.

## [Unreleased]

### Added — Fase F6 (Docker, Proxy Reverso Nginx, CI/CD & Auditoria de Produção)
- **Containerização & Proxy Reverso (`backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`, `.dockerignore`):**
  - Build multi-stage em `node:24-alpine` no backend (`npm ci --omit=dev`, usuário não-root `USER node`, healthcheck nativo Node `fetch`) e build Vite + `nginx:1.27-alpine` no frontend com proxy reverso `/api/` -> `http://backend:3000`, cache imutável em `/assets/`, `no-cache` em `/index.html`, cabeçalhos de segurança e fallback SPA.
  - Orquestração sem banco local nem MSSQL via [`docker-compose.yml`](docker-compose.yml), rede `hr-hunter-net` com `enable_ipv6: true`, porta padrão `FRONTEND_PORT=8081` (evitando conflito com `8080`) e conexão direta ao Supabase externo via `.env` (IPv6 nativo ou Supabase IPv4 Session Pooler).
- **Hardening HTTP, Proxy & Config (`backend/app.js`, `backend/config/env.js`, `backend/utils/tokenUtils.js`, `frontend/src/services/api.ts`, `frontend/src/vite-env.d.ts`, `.env.example`):**
  - Ativado `app.set('trust proxy', 1)` atrás do Nginx, adicionado controle explícito `COOKIE_SECURE` para cookies `hr_refresh_token` e ajuste condicional da diretiva CSP `upgrade-insecure-requests` apenas em HTTP local (`COOKIE_SECURE=false`), além de `VITE_API_BASE_URL=/api/v1` no cliente Axios.
- **CI/CD & Script de Auditoria (`scripts/verify.js`, `.github/workflows/ci.yml`, `package.json`):**
  - Pipeline GitHub Actions (`lint-build-and-audit`, `playwright-unit-and-ct`, `playwright-api-and-e2e`) com proteção para forks sem secrets, validação de `docker compose config -q`, build das imagens Docker e publicação de relatórios Playwright.
  - Scripts `verify:syntax` (80 arquivos JS), `verify:sql` (7 migrations PostgreSQL sem dialeto MSSQL), `verify:security` (0 vazamentos em arquivos rastreados), `verify:docs` (11 Markdowns com 0 links relativos quebrados), `verify:swagger` (OpenAPI `3.0.3`, `68` paths, `95` operações) e `lint`.
- **Sincronização Integral da Documentação & Validação Final:**
  - Atualizados todos os documentos (`docs/API.md`, `docs/DATABASE.md` com as 8 rotinas PL/pgSQL, `docs/DATA_MAPPING.md`, `docs/SECURITY_AND_PERMISSIONS.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/PLANO_MESTRE.md`, `README.md` e `CHANGELOG.md`).
  - Validação integral aprovada: `docker build` de ambas as imagens (`backend` e `frontend`) com exit `0`, `npm run verify:ci`, `npm run lint`, `npm run build:frontend` e `61/61` testes Playwright aprovados (`22` Component Tests + `18` Unit + `15` API + `6` E2E; `0` falhas, `0` pulados, `0` registros residuais `pw%` no Supabase).

### Added — Fase F5 (Frontend CRUDs, Pipeline Kanban, Dashboard Analítico & Settings Admin)
- **Contratos Tipados, Formatadores & Serviços (`frontend/src/types/domain.ts`, `utils/formatters.ts`, `services/*.ts`):**
  - DTOs e payloads completos cobrindo Empresas, Vagas, Candidatos (+ sub-recursos e CSV), Processos (Kanban, Propostas, Timeline), Usuários, Dashboard, Settings, Segurança/Alertas, Retenção LGPD, Matriz RBAC e Backup.
  - Utilitários de formatação PT-BR/EN-US (CNPJ, CPF opcional, CEP, telefone, moeda, datas) e serviços HTTP dedicados (respeitando `limit <= 20` em `companyService.ts` e downloads autenticados via `responseType: 'blob'` em `securityAdminService.ts`).
- **Módulos de Negócio (`CompaniesPage`, `JobOpeningsPage`, `CandidatesPage`, `UsersPage`, `ProfilePage`):**
  - Páginas CRUD completas com `FilterBar`, `DataTable`, `StatusBadge`, `ConfirmModal` reutilizável e feedback via `ToastContext`.
  - Bloqueio estrutural de edição em vagas `Preenchida` + modal de detalhes com abas (`JobDetailsModal`), formulário multiaba de candidatos com **CPF opcional** e importação em massa CSV, força de senha + reset administrativo em `UsersPage` e sincronia dinâmica de idioma em `ProfilePage`.
- **Pipeline Kanban (`ProcessesPage`, `ProcessKanban`, `ProcessDetailModal`):**
  - Alternância Kanban (padrão) e Tabela com tradução automática das colunas via `stageTranslation.ts` e isolamento de renderização por `content-visibility: auto` (`contain-intrinsic-size` + fallback `@supports not`).
  - Drag-and-drop nativo e botões acessíveis de avanço/retorno por teclado com anúncios `role="status"` apenas em mudança efetiva; avaliação 1–5 estrelas, criação/decisão de propostas (`advanceToHired`), rejeição e linha do tempo.
- **Dashboard Analítico (`DashboardPage`, `KpiCard`, `AccessibleCharts`, `CriticalProcessesCard`):**
  - Filtros globais de período/empresa/departamento, 7 KPIs, 4 gráficos SVG com alternância acessível para tabela de dados, Top 5 empresas contratantes, processos críticos e atualização automática configurável (5 min).
- **Configurações Administrativas — 9 Abas (`SettingsPage`, `components/settings/*`, `Tabs.tsx`):**
  - Componente `Tabs` WAI-ARIA (`selectionMode="activation"`, sem `aria-controls` redundante, painéis inativos `hidden`, indicador por borda inferior para alto contraste).
  - Implementadas todas as 9 abas: Geral (mascaramento `********`), Etapas & Funis, E-mail & Templates, Segurança & Retenção (Dry-Run LGPD + execução paralela de contagens em `retentionService.js`), Audit Log (JSON diff), Login History, Segurança/Alertas (`<progress>` nativo de risco, resolução e exports CSV/PDF autenticados), Permissões RBAC (trava somente leitura em `Admin`) e Backup/Snapshot JSON/SQL. Documentado em [docs/SETTINGS_MODULE.md](docs/SETTINGS_MODULE.md).
- **Testes & Correções:** `22/22` Component Tests (`Phase5Widgets.spec.tsx` + F4) e `39/39` Root Unit/API/E2E (`crud-and-kanban.spec.ts`, `dashboard-and-settings.spec.ts` etc.), totalizando `61/61` testes Playwright aprovados e `0` registros `pw%` residuais no Supabase.

### Added — Fase F4 (Frontend Base, Design System, Auth, RBAC Granular & Componentes Comuns)
- **Design System & Componentes Comuns (`frontend/src/styles/globals.css`, `frontend/src/components/common/`):**
  - Mantidos `Button` (+ variante `danger` / `size`), `StatusBadge` (+ variante `info`), `LanguageSwitcher` e `PageHeader`.
  - Adicionados `Loader` / `Skeleton`, `Input` (dicas não obstrutivas acima do campo, `:user-invalid`/`:user-valid`, `aria-describedby` dinâmico e toggle mostrar/ocultar senha `aria-pressed`), `Select`, `Autocomplete` acessível por teclado, `FilterBar` (`<search>`), `DataTable` (`<caption>`, ordenação `<th scope="col">` + `aria-sort` + `role="status"` + layout móvel empilhado via `@container`), `Modal` (`<dialog>` top-layer com `overscroll-behavior: contain` no `:modal` e `::backdrop`), `ToastViewport` e `RichTextEditor` (variáveis de template + sanitização XSS na pré-visualização).
- **Layout, i18n & Utilitários (`frontend/src/components/layout/`, `frontend/src/utils/`, `frontend/src/i18n/`):**
  - Criados `MainLayout` (skip link `#main-content`), `Sidebar` (280px expandido / 72px recolhido / drawer `<dialog>` móvel filtrados dinamicamente por RBAC) e `Header` (popover de notificações com contagem de não lidas + mark-read, idioma e menu do usuário).
  - Adicionados `stageTranslation.ts` (tradução das 9 etapas padrão preservando etapas customizadas), `passwordPolicy.ts`, `sanitizer.ts` (`Element.prototype.setHTML` + fallback `dompurify`) e expansão completa de `pt-BR.json` e `en-US.json`.
- **Auth, RBAC Granular & Rotas (`frontend/src/contexts/`, `frontend/src/components/auth/`, `frontend/src/pages/`):**
  - `api.ts` e `authService.ts` com `withCredentials: true`, retry único single-flight em `401` (sem loop em rotas públicas) e leitura de erros estruturados `parseApiError`.
  - `AuthContext` com persistência em reload via cookie `HttpOnly` e refresh agendado pré-expiração; `PermissionsContext` com cache `localStorage` (`TTL 5 min`) + sincronia sem *race condition*; `RoleProtectedRoute` aguardando `authLoading || permissionsLoading` antes de decidir redirecionamento.
  - Páginas `Login`, `ForgotPassword`, `ResetPassword`, `AccessDenied` e shells autenticados em `App.tsx` / `ModuleShellPage.tsx`.
- **Testes Playwright (`55/55` aprovados):**
  - Component Tests (`18/18`): `CommonWidgets.spec.tsx` (6), `AuthAndRbac.spec.tsx` (6) e 6 testes base da Fase 1.
  - Unit, API & E2E (`37/37`): `tests/unit/stageTranslation.spec.ts` (3), atualização de `tests/e2e/smoke.spec.ts` (1) e `tests/e2e/auth.spec.ts` (3) integrados ao Supabase PostgreSQL real (`0` falhas, `0` pulados).

### Added — Fase F3 (Backend CRUDs Core, Dashboard Analytics & Settings)
- **Módulos CRUD Completos (`backend/validators/`, `backend/services/`, `backend/controllers/`, `backend/routes/`):**
  - **Empresas (`/api/v1/companies`):** paginação limitada (`<= 20`/pág), validação de CNPJ único (`409`), estatísticas de vagas/candidatos e soft delete com guarda contra vagas ativas (`409`).
  - **Vagas (`/api/v1/job-openings`):** normalização de aliases `salaryMin`/`salaryMax`, lock de edição em vagas `Preenchida` (`409`), `/candidates`, `/analytics` e guarda de exclusão com processos ativos.
  - **Candidatos (`/api/v1/candidates`):** criação transacional, `cpf` opcional (`NULL` múltiplo via índice único parcial), CRUD de sub-recursos (`/experience`, `/education`, `/skills`) e importação em lote CSV (`POST /import` via `multer` + `csvParser.js`).
  - **Processos Seletivos (`/api/v1/processes`):** visão `/kanban`, `/next-stage` via `fn_move_to_next_stage`, `/reject` com envio opcional de template, `/offer` + `PATCH /offer/:offerId` (conclusão automática em `Contratado`) e `/timeline` cronológica.
  - **Usuários (`/api/v1/users`):** CRUD administrativo, atualização restrita de autoperfil, `/activity` e `/reset-password`.
- **Dashboard & Configurações (`/api/v1/dashboard/*`, `/api/v1/settings/*`):**
  - Integração às funções `fn_get_dashboard_kpis`, `fn_get_dashboard_analytics`, `fn_get_candidates_by_stage`, `fn_get_critical_processes` e view `vw_recruitment_metrics`.
  - Gestão de configurações com mascaramento `is_sensitive`, CRUD de etapas/funis, templates HTML sanitizados com proteção `is_system = true` (`403`), `/email-test`, `/audit-log`, `/login-history` e `/backup` (snapshot lógico JSON/SQL auditado).
- **Utilitários & Documentação API:** criados `queryHelpers.js`, `csvParser.js`, `responseHelper.js`, aprimorado `renderTemplate` em `sanitizer.js`, e Swagger expandido para `68` paths / `95` operações.
- **Testes Playwright (`37/37` aprovados):** adicionados `tests/unit/phase3-helpers.spec.ts` (4) e 6 suítes API (`companies`, `job-openings`, `candidates`, `processes`, `users`, `dashboard-and-settings`), elevando a suíte para `15` unit + `15` API + `1` E2E + `6` Component Tests (`0` falhas, `0` pulados).

### Fixed — Fase F3
- **`backend/utils/dbMapper.js` (`normalizeOptionalString`):** conversão segura de instâncias `Date` (geradas por `Joi.date().iso()`) para string ISO UTC antes da persistência em `TIMESTAMPTZ`.
- **`backend/services/processService.js`:** execução de `getProcessById` após o `COMMIT` de `withTransaction` em `createProcess`; serialização de queries no mesmo `client` transacional (também corrigido em `settingsService.js` eliminando `DeprecationWarning` do `pg`); e cast explícito `$1::varchar` / `$1::text` no `UPDATE offers` evitando erro PostgreSQL `42P08`.
- **`playwright.config.ts`:** ajuste de `RATE_LIMIT_MAX_REQUESTS` (`1000`) para execução paralela de múltiplos workers API sem falso positivo de rate-limit.

### Added — Fase F2 (Backend Core: Auth JWT, RBAC Granular, Segurança, Exports, Analytics & Retenção)
- **Autenticação & Política de Senha (`authService.js`, `tokenUtils.js`, `passwordPolicy.js`, `authController.js`, `routes/auth.js`):**
  - Endpoints `/api/v1/auth/login`, `logout`, `refresh-token`, `forgot-password`, `reset-password`, `permissions` e `me`.
  - Access token JWT (`1h`) + refresh token opaco de 48 bytes em hash SHA-256 via cookie `HttpOnly` (`hr_refresh_token`), com rotação transacional e revogação total em caso de reuso (replay).
  - Bloqueio automático após 5 tentativas incorretas (`423 AUTH_004` + alerta `BRUTE_FORCE_LOCKOUT`) e `loginLimiter` por IP+email (`429 AUTH_RATE_LIMIT`).
  - Redefinição de senha anti-enumeração com expiração de 1h, política de complexidade forte (`VAL_004`) e SMTP opcional via `nodemailer`.
- **RBAC Granular & Auditoria (`permissionService.js`, `authorize.js`, `auditMiddleware.js`, `routes/permissions.js`):**
  - Endpoints `/api/v1/permissions/matrix`, `PUT /permissions/roles/:role` (protegendo role `Admin` com `403`, gravando `PERMISSION_CHANGE` em transação e invalidando cache TTL 5 min) e `GET /permissions/audit-log`.
  - Redação recursiva de segredos em `auditService.js` (`password`, `token`, `refreshToken`, etc.).
- **Alertas Automáticos, Notificações, Exports, Analytics & Retenção:**
  - Registro automático em `unauthorized_access_log` e escalação de alertas em `securityAlertService.js` (`>=5` usuário/h → `HIGH`, `>=10` IP/h → `CRITICAL`) com notificações para administradores (`/api/v1/security-alerts/*`, `/api/v1/notifications/*`).
  - Exportações em CSV UTF-8 com proteção contra *formula injection* (`sanitizer.js`) e PDF (`pdfkit`) sob `exportLimiter` (`10`/h) em `/api/v1/exports/*`.
  - Score de risco `0..100`, recomendações automáticas e histórico em `security_reports` via `/api/v1/analytics/*`.
  - Limpeza configurável por categoria `Retention` (`dryRun`, execução manual `/api/v1/retention/*` e scheduler `node-cron` em `America/Sao_Paulo` na inicialização do `server.js`).
- **Testes Playwright (`27/27` aprovados):**
  - Adicionados `tests/unit/auth.spec.ts` (3), `tests/unit/permissions.spec.ts` (4), `tests/api/auth.spec.ts` (3) e `tests/api/permissions-and-security.spec.ts` (3), elevando a suíte total para `11` unit + `9` API + `1` E2E + `6` Component Tests (`0` falhas, `0` pulados).
- **Documentação Sincronizada (`docs/`):**
  - Criados `docs/API.md` e `docs/SECURITY_AND_PERMISSIONS.md`; atualizados `docs/PLANO_MESTRE.md`, `docs/ARCHITECTURE.md`, `docs/SETUP.md`, `docs/TESTING.md`, `README.md` e `CHANGELOG.md`.

### Fixed — Fase F2
- **`backend/utils/dbMapper.js`:** Ajustada regex de `snakeToCamel` para `/_([a-z0-9])/g`, garantindo conversão correta de colunas com dígitos (`last_24h` → `last24h`, `last_7d` → `last7d`).
- **`backend/validators/authValidator.js`:** Configurado `{ tlds: { allow: false } }` na validação de e-mail do Joi para compatibilidade com domínios internos e de teste.
- **`tests/api/permissions-and-security.spec.ts`:** Isolamento de dados por sufixo exclusivo e autossuficiência de cenários entre workers paralelos do Playwright.

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
