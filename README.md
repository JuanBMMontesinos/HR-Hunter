# HR Hunter

Plataforma web de gestão de recrutamento e seleção (ATS/CRM) construída com **React + Vite + TypeScript**, **Node.js + Express**, **Supabase (PostgreSQL)** e suíte unificada de testes com **Playwright**.

> **Status Atual:** Fase `F4` concluída (Design System `design-system.json`, biblioteca de componentes acessíveis + `MainLayout`, i18n completo com `stageTranslation.ts`, `AuthContext` com refresh cookie `HttpOnly` + single-flight `401`, `PermissionsContext` + `RoleProtectedRoute` sem race condition, telas `Login`, `ForgotPassword`, `ResetPassword`, `AccessDenied` e `55/55` testes Playwright aprovados). Próxima etapa: **Fase `F5`** conforme [`docs/PLANO_MESTRE.md`](docs/PLANO_MESTRE.md).

## Stack Implementada

- **Frontend:** React 18, React Router 7, Vite 6, TypeScript 5.7, CSS Layers + Custom Properties (`design-system.json`), `react-i18next` (`pt-BR` / `en-US`), Axios, Lucide React, DOMPurify (`setHTML` nativo com fallback)
- **Backend:** Node.js, Express, `pg` (PostgreSQL), `jsonwebtoken`, `bcrypt`, `joi`, `pdfkit`, `nodemailer`, `node-cron`, Helmet, CORS restritivo, `express-rate-limit`, Winston, Swagger/OpenAPI (`/api/docs`, `/api/docs.json`)
- **Banco de Dados:** Supabase (PostgreSQL Manageado, `project_ref=fhhgtjzwmhgdiokqqebg`)
- **Testes:** Playwright (`@playwright/test` para unit/API/E2E e `@playwright/experimental-ct-react` para testes unitários de componentes)

## Estrutura do Repositório

```text
HR-Hunter/
├── .agents/
│   └── skills/
│       ├── docs-sync/SKILL.md                 # Sincronização contínua de documentação
│       ├── git-commit-push/SKILL.md           # Fluxo seguro de commit/push para este repo
│       └── playwright-unit-testing/SKILL.md   # Padrão unificado de testes Playwright
├── backend/
│   ├── config/                                # env.js, database.js (pg pool + tx), swagger.js
│   ├── controllers/                           # auth, permissions, securityAlerts, notifications, exports, analytics, retention, companies, jobOpening, candidate, process, user, dashboard, settings
│   ├── middleware/                            # authenticate, authorize, audit, cors, errorHandler, rateLimiter, validation
│   ├── routes/                                # health, auth, permissions, security-alerts, notifications, exports, analytics, retention, companies, job-openings, candidates, processes, users, dashboard, settings
│   ├── services/                              # Regras de negócio transacionais (Auth, RBAC, Alertas, Exports, Analytics, Retenção, CRUDs Core, Dashboard, Settings)
│   ├── utils/                                 # csvParser, dbMapper, errorCodes, logger, passwordPolicy, queryHelpers, responseHelper, sanitizer, tokenUtils
│   ├── validators/                            # Schemas Joi (auth, security, company, jobOpening, candidate, process, user, dashboardAndSettings)
│   ├── app.js
│   └── server.js
├── database/
│   ├── migrations/                            # 001..007 SQL idempotentes aplicados no Supabase
│   └── scripts/                               # db.js, migrate.js, seed.js, inspect.js
├── docs/
│   ├── API.md                                 # Referência dos endpoints REST (`/api/v1`)
│   ├── ARCHITECTURE.md                        # Arquitetura do sistema e padrões técnicos
│   ├── DATABASE.md                            # Schema Supabase (27 tabelas, 3 views, 17 triggers, 8 funções)
│   ├── DATA_MAPPING.md                        # Mapeamento snake_case <-> camelCase e normalizações
│   ├── PLANO_MESTRE.md                        # Plano mestre v2.0 e roadmap F0–F6
│   ├── SECURITY_AND_PERMISSIONS.md            # Auth, rate limit, RBAC granular, alertas e retenção
│   ├── SETUP.md                               # Guia completo de instalação, env e execução
│   └── TESTING.md                             # Guia e cobertura da suíte unificada Playwright
├── frontend/
│   ├── playwright/                            # Harness do Playwright Component Testing
│   ├── src/
│   │   ├── components/                        # auth/, common/ e layout/ (Header, Sidebar, MainLayout)
│   │   ├── contexts/                          # AuthContext, PermissionsContext, ToastContext
│   │   ├── hooks/                             # usePermissions
│   │   ├── i18n/                              # react-i18next (pt-BR, en-US)
│   │   ├── pages/                             # auth/ e ModuleShellPage
│   │   ├── services/                          # api.ts (Axios single-flight 401), authService.ts
│   │   ├── styles/                            # variables.css + globals.css
│   │   ├── types/                             # auth.ts, common.ts
│   │   ├── utils/                             # passwordPolicy.ts, sanitizer.ts, stageTranslation.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/ct/                              # Testes unitários de componentes React (Playwright CT) + harnesses/
│   ├── playwright-ct.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
├── tests/
│   ├── unit/                                  # Testes unitários via Playwright
│   ├── api/                                   # Testes de integração API + Supabase via Playwright
│   └── e2e/                                   # Testes E2E no browser Chromium via Playwright
├── .env.example                               # Modelo de variáveis de ambiente (sem segredos)
├── .gitignore                                 # Proteção de .env, artefatos e dependências
├── CHANGELOG.md                               # Registro cronológico de mudanças
├── design-system.json                         # Tokens visuais e contrato de componentes WCAG 2.1 AA
├── package.json                               # Scripts unificados de workspace, DB, dev e testes
├── playwright.config.ts                       # Configuração Playwright (unit, api, e2e)
└── README.md                                  # Este arquivo
```

## Comandos Principais

```bash
# 1. Configure variáveis de ambiente em HR-Hunter/.env (use .env.example como base)

# 2. Instale dependências da raiz, backend e frontend
npm run install:all

# 3. Instale os browsers Chromium (raiz e Playwright CT em frontend)
npx playwright install chromium
npx --prefix frontend playwright install chromium

# 4. Aplique migrations e seed idempotente no Supabase
npm run db:setup

# 5. Execute Backend (porta 3000) e Frontend (porta 5173) em terminais separados
npm run dev:backend
npm run dev:frontend

# 6. Execute testes e validações de build
npm run typecheck:frontend
npm run build:frontend
npm run test:ct
npm test
```

## Documentação

- [Plano Mestre de Arquitetura e Roadmap (v2.0)](docs/PLANO_MESTRE.md)
- [Guia de Setup e Ambiente](docs/SETUP.md)
- [Arquitetura do Sistema](docs/ARCHITECTURE.md)
- [Documentação da API (`/api/v1`)](docs/API.md)
- [Segurança, Autenticação & Permissões RBAC](docs/SECURITY_AND_PERMISSIONS.md)
- [Banco de Dados (Supabase PostgreSQL)](docs/DATABASE.md)
- [Mapeamento de Dados (`snake_case` ↔ `camelCase`)](docs/DATA_MAPPING.md)
- [Guia de Testes Automatizados (Playwright)](docs/TESTING.md)
- [Changelog](CHANGELOG.md)
- [Design System](design-system.json)
