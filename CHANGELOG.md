# Changelog

Todas as mudanças notáveis do projeto **HR Hunter** serão documentadas neste arquivo.

## [Unreleased]

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
