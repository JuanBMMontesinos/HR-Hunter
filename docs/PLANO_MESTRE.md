# HR Hunter — Plano Mestre de Arquitetura & Implementação (v2.0)

**Status Atual:** 🟡 F0 — Planejamento, Prompt Atualizado e Governança Concluídos  
**Repositório:** `https://github.com/JuanBMMontesinos/HR-Hunter`  
**Banco de Dados:** Supabase PostgreSQL (`project_ref=fhhgtjzwmhgdiokqqebg`)  
**Suíte de Testes:** Playwright (`@playwright/test` + `@playwright/experimental-ct-react`)  
**Última Atualização:** 2026-11-15  

---

## 1. Visão Geral e Mudanças Estruturais (v1 MSSQL → v2 Supabase)

Este documento consolida o novo planejamento do **HR Hunter** a partir dos documentos em `PRDs/` (`HR_Hunter_PRD.md`, `HR_Hunter_Tech_Spec.md`, `HR_Hunter_SQL.md`, `HR_Hunter_Roadmap.md`, `HR_Hunter_Index.md`, `HR_Hunter_AI_Prompts_Supabase.md`), incorporando lições arquiteturais da primeira versão para eliminar falhas conhecidas desde o dia 1:

| Pilar | Especificação Anterior (`PRDs/` originais) | Novo Planejamento (v2.0) |
|---|---|---|
| **Banco de Dados** | MS SQL Server 2025 (T-SQL, `sp_*`) | **Supabase (PostgreSQL 15/16+)** com migrations SQL idempotentes (`database/migrations/*.sql`) executadas diretamente via MCP ou `DATABASE_URL` |
| **Convenção de Schema** | `PascalCase` no BD vs `camelCase` na API/UI | **`snake_case` no PostgreSQL** + **DTOs `camelCase` padronizados** em toda API e Frontend (evitando bugs de mapeamento) |
| **CPF Opcional** | `UNIQUE` do MSSQL bloqueava múltiplos `NULL` | Índice único parcial PostgreSQL: `WHERE cpf IS NOT NULL AND cpf <> ''` + normalização de `""` para `NULL` |
| **Testes** | Jest + Vitest + Cypress fragmentados | **Playwright unificado**: Component Unit Tests (`@playwright/experimental-ct-react`), Unit/API Tests (`@playwright/test`) e E2E (`tests/e2e/`) |
| **Segurança & RBAC** | Roles fixas iniciais | Matriz granular (`permissions` + `role_permissions`), cache TTL 5min, `RoleProtectedRoute` aguardando `authLoading && permissionsLoading`, alertas automáticos e retenção de dados |
| **Documentação & Git** | Manuais atualizados manualmente após entrega | Skills obrigatórias em `.agents/skills/`: `playwright-unit-testing`, `git-commit-push` e `docs-sync` |

---

## 2. Arquitetura Alvo

```text
┌────────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React 18 + Vite + TS)              │
│  Design System (design-system.json) | i18n (PT-BR / EN-US)         │
│  AuthContext + PermissionsContext + ToastContext                   │
│  Pages: Dashboard, Companies, JobOpenings, Candidates,             │
│         Processes (Kanban), Users, Settings, AccessDenied          │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │ HTTPS / REST JSON + HttpOnly Cookie
┌─────────────────────────────────▼──────────────────────────────────┐
│                       BACKEND (Node.js 18+ + Express)              │
│  Helmet | Restrictive CORS | Rate Limiter | Joi Validation         │
│  Auth (JWT 1h + Refresh 7d + Bcrypt 10) | Granular RBAC            │
│  Audit Middleware | Scheduled Retention Jobs (node-cron)           │
│  Swagger /api/docs | Parameterized SQL ($1, $2...) via `pg`        │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │ TLS / PostgreSQL Wire (5432)
┌─────────────────────────────────▼──────────────────────────────────┐
│                    SUPABASE (PostgreSQL 15/16+)                    │
│  project_ref: fhhgtjzwmhgdiokqqebg                                 │
│  20+ Tabelas snake_case | Partial Unique Index (CPF)               │
│  Triggers (updated_at, stage sync, delete guard)                   │
│  Views (vw_*) | Functions (fn_get_dashboard_kpis, fn_move_...)     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plano de Migrations no Supabase (`database/migrations/`)

As migrations serão criadas e aplicadas diretamente no Supabase (via MCP `supabase` ou runner Node `pg` com `DATABASE_URL` no `.env` local):

| Ordem | Arquivo | Tabelas / Objetos | Origem & Adaptação |
|---:|---|---|---|
| `001` | `001_core_users_auth.sql` | `schema_migrations`, `users`, `refresh_tokens`, `password_reset_tokens`, `login_history` | Auth + lockout 5 tentativas / 15 min |
| `002` | `002_companies_jobs.sql` | `companies`, `job_openings` (inclui `funnel_id`) | CNPJ único, soft delete, status/prioridade |
| `003` | `003_candidates.sql` | `candidates`, `candidate_experience`, `candidate_education`, `candidate_skills` | Índice único parcial em `cpf` permitindo múltiplos `NULL` |
| `004` | `004_funnels_processes_offers.sql` | `recruitment_stage_template`, `stage_funnels`, `stage_funnel_items`, `recruitment_processes`, `process_stages`, `offers` | Funis customizáveis + Kanban + Ofertas |
| `005` | `005_settings_email_audit.sql` | `configurations`, `email_templates`, `audit_log` | Templates com `is_system` + auditoria `JSONB` |
| `006` | `006_permissions_security.sql` | `permissions`, `role_permissions`, `security_alerts`, `notifications`, `unauthorized_access_log`, `security_reports` | RBAC 7×4 + alertas e score de risco |
| `007` | `007_triggers_views_functions.sql` | `fn_set_updated_at`, `fn_prevent_delete_active_company`, `fn_sync_process_stage`, `vw_*`, `fn_get_dashboard_*`, `fn_move_to_next_stage` | Conversão integral de triggers, views e SPs T-SQL para PL/pgSQL |
| `seed` | `database/seeds/001_initial_seed.sql` | Etapas padrão, funil padrão, permissões 5 roles, configs, templates, usuários, dados realistas | Garantia de **zero tabelas vazias** |

---

## 4. Roadmap de Execução por Fases

### Fase F0 — Planejamento, Prompt & Skills ✅ Concluído
- [x] Análise completa dos documentos em `PRDs/` (`HR_Hunter_AI_Prompts.md`, `HR_Hunter_PRD.md`, `HR_Hunter_Tech_Spec.md`, `HR_Hunter_SQL.md`, `HR_Hunter_Roadmap.md`, `HR_Hunter_Index.md`)
- [x] Criação do prompt atualizado para Supabase + Playwright em `PRDs/HR_Hunter_AI_Prompts_Supabase.md`
- [x] Criação das 3 skills em `.agents/skills/`: `playwright-unit-testing`, `git-commit-push`, `docs-sync`
- [x] Configuração de `.gitignore`, `.env.example`, `.env` local (gitignored) e `design-system.json`
- [x] Criação do `docs/PLANO_MESTRE.md`, `README.md` e `CHANGELOG.md`
- [x] Validação de conectividade IPv6/porta 5432 com `db.fhhgtjzwmhgdiokqqebg.supabase.co`

### Fase F1 — Setup do Monorepo, Banco Supabase & Migrations ⏳ Próxima
- [ ] Inicializar workspace root, `backend/` (Express + `pg` + Swagger + Winston + Joi) e `frontend/` (React 18 + Vite + TS + Design System)
- [ ] Criar e aplicar migrations `001` a `007` e `001_initial_seed` diretamente no Supabase
- [ ] Configurar `playwright.config.ts` e `frontend/playwright-ct.config.ts`
- [ ] Criar `docs/DATABASE.md`, `docs/DATA_MAPPING.md` e atualizar `docs/SETUP.md`
- [ ] Commit e push para `https://github.com/JuanBMMontesinos/HR-Hunter`

### Fase F2 — Backend Core: Auth, RBAC Granular & Segurança
- [ ] Implementar Auth (`/auth/login`, `logout`, `refresh-token`, `forgot-password`, `reset-password`, `permissions`)
- [ ] Implementar Permissões Granulares (`/permissions/matrix`, `roles/:role`, `audit-log`)
- [ ] Implementar Alertas de Segurança, Notificações, Exports CSV/PDF, Analytics (`SecurityReports`) e Retenção (`node-cron`)
- [ ] Cobrir com testes Playwright (`tests/unit/` e `tests/api/`) + atualizar `docs/API.md` e `docs/SECURITY_AND_PERMISSIONS.md`

### Fase F3 — Backend CRUDs & Dashboard Analytics
- [ ] Implementar CRUDs `companies`, `job-openings`, `candidates` (+ sub-recursos + CSV import), `processes` (Kanban, next-stage, reject, offer, timeline), `users`
- [ ] Implementar Dashboard KPIs, Analytics e Processos Críticos usando funções/views do Supabase
- [ ] Implementar Settings (Geral, Funis/Etapas, Email Templates, Audit/Login History, Snapshot lógico)
- [ ] Cobrir 100% dos endpoints com testes Playwright integrados ao Supabase + atualizar `docs/API.md` e Swagger

### Fase F4 — Frontend Base, Design System, Auth & RBAC
- [ ] Implementar tokens de `design-system.json` (`variables.css`), componentes comuns (`PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `Modal`, `Toast`, `RichTextEditor`)
- [ ] Configurar i18n completo (`pt-BR.json`, `en-US.json`, `stageTranslation.ts`)
- [ ] Implementar `AuthContext`, `PermissionsContext`, `RoleProtectedRoute` (aguardando ambos loadings), `Login`, `ForgotPassword`, `ResetPassword`, `AccessDenied`
- [ ] Criar testes unitários de componentes com Playwright CT (`frontend/tests/ct/`) e E2E de auth (`tests/e2e/auth.spec.ts`)

### Fase F5 — Frontend CRUDs, Dashboard & Settings
- [ ] Implementar páginas `Companies`, `JobOpenings`, `Candidates`, `Processes` (Kanban + Lista + Timeline + Oferta), `Users`
- [ ] Implementar `Dashboard` com filtros globais, KPIs, 4 gráficos acessíveis e Processos Críticos
- [ ] Implementar `Settings` com todas as 9 abas (incluindo `PermissionsManager` e `SecurityDashboard`)
- [ ] Cobrir componentes com Playwright CT e fluxos completos com Playwright E2E

### Fase F6 — Docker, CI/CD, Auditoria Final & Produção
- [ ] Criar Dockerfiles (`backend`, `frontend`) e `docker-compose.yml` (sem MSSQL)
- [ ] Configurar GitHub Actions (`.github/workflows/ci.yml`) com lint, build, verificação de segredos e Playwright
- [ ] Auditoria completa de `docs/*.md`, `README.md`, `CHANGELOG.md` e Swagger contra o código real
- [ ] Execução integral de todas as suítes Playwright + validação final e push para `main`

---

## 5. Riscos Conhecidos & Mitigações

| Risco | Mitigação Definida |
|---|---|
| Vazamento de credenciais do Supabase no GitHub | `.gitignore` bloqueando `.env*` + gate obrigatório na skill `git-commit-push` + CI check |
| Conectividade IPv6 com `db.*.supabase.co` em ambientes sem IPv6 | Verificado que este ambiente local possui IPv6 ativo; documentar também uso do Session Pooler IPv4 do Supabase para CI/containers se necessário |
| Dessincronização entre código, migrations e docs | Skill `docs-sync` exige atualização dos `.md` e Swagger no mesmo commit de cada alteração |
| Race condition de permissões após login | `RoleProtectedRoute` bloqueia decisão até `authLoading === false && permissionsLoading === false` |
| Dados de teste poluindo o banco Supabase | Isolamento por prefixo único + limpeza obrigatória em `afterEach`/`afterAll` nos testes Playwright |
