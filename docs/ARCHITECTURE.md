# Arquitetura do Sistema — HR Hunter (v2.0)

**Versão:** 2.0 (Fase 3 — CRUDs Core, Dashboard Analytics & Settings)  
**Última Atualização:** 2026-11-15  

---

## 1. Estrutura do Repositório

```text
HR-Hunter/
├── .agents/
│   └── skills/
│       ├── docs-sync/SKILL.md
│       ├── git-commit-push/SKILL.md
│       └── playwright-unit-testing/SKILL.md
├── backend/
│   ├── config/
│   │   ├── database.js          # Pool PostgreSQL (pg) + healthCheck + withTransaction
│   │   ├── env.js               # Carregamento e defaults de variáveis de ambiente
│   │   └── swagger.js           # Especificação OpenAPI 3.0 (/api/docs)
│   ├── controllers/             # Auth, Permissions, SecurityAlerts, Notifications, Exports, Analytics, Retention, Company, JobOpening, Candidate, Process, User, Dashboard, Settings
│   ├── middleware/
│   │   ├── auditMiddleware.js   # Registro assíncrono em audit_log + metadados IP/UA
│   │   ├── authenticate.js      # Validação JWT + verificação de usuário ativo
│   │   ├── authorize.js         # RBAC granular authorize(resource, action) e requireAdmin
│   │   ├── corsMiddleware.js    # CORS restritivo via FRONTEND_URL
│   │   ├── errorHandler.js      # Resposta padrão de erros com códigos customizados
│   │   ├── rateLimiter.js       # Limite API geral, loginLimiter e exportLimiter (10/h)
│   │   └── validationMiddleware.js # Validação Joi declarativa
│   ├── routes/                  # health, auth, permissions, securityAlerts, notifications, exports, analytics, retention, companies, jobOpenings, candidates, processes, users, dashboard, settings
│   ├── services/                # Regras de negócio transacionais integradas ao Supabase
│   ├── utils/
│   │   ├── csvParser.js         # Parser CSV RFC-4180 (BOM UTF-8 e delimitador , ou ;)
│   │   ├── dbMapper.js          # Conversão snake_case <-> camelCase e normalizações (inclui Date)
│   │   ├── errorCodes.js        # Enum ErrorCodes e classe AppError
│   │   ├── logger.js            # Winston structured logger
│   │   ├── passwordPolicy.js    # Validação de complexidade de senha
│   │   ├── queryHelpers.js      # Paginação, SqlFilterBuilder, buildDynamicUpdate e handlePgError
│   │   ├── responseHelper.js    # Envelope padrão de resposta (sendSuccess, actorMeta)
│   │   ├── sanitizer.js         # Proteção XSS HTML, renderTemplate e CSV formula injection
│   │   └── tokenUtils.js        # JWT sign/verify, tokens opacos SHA-256 e cookie options
│   ├── validators/              # Schemas Joi (auth, security, company, jobOpening, candidate, process, user, dashboardAndSettings)
│   ├── app.js                   # App Express (exportável para testes/servidor)
│   ├── server.js                # Bootstrap HTTP, cron scheduler e graceful shutdown
│   └── package.json
├── database/
│   ├── migrations/              # 001..007 SQL idempotentes para Supabase PostgreSQL
│   └── scripts/
│       ├── db.js                # Pool compartilhado para CLI/testes
│       ├── migrate.js           # Runner com controle SHA-256 em schema_migrations
│       ├── seed.js              # Seed idempotente (zero tabelas de domínio vazias)
│       └── inspect.js           # Auditoria de tabelas, views, triggers e funções
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DATA_MAPPING.md
│   ├── PLANO_MESTRE.md
│   ├── SECURITY_AND_PERMISSIONS.md
│   ├── SETUP.md
│   └── TESTING.md
├── frontend/
│   ├── playwright/              # Harness do Playwright Component Testing
│   ├── src/
│   │   ├── components/common/   # Button, StatusBadge, PageHeader, LanguageSwitcher
│   │   ├── i18n/                # react-i18next (pt-BR, en-US)
│   │   ├── services/api.ts      # Cliente Axios (/api/v1) e tipos de health check
│   │   ├── styles/              # variables.css (design-system.json) + globals.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/ct/                # Testes unitários de componentes React (Playwright CT)
│   ├── playwright-ct.config.ts
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── tests/
│   ├── unit/                    # Testes unitários via Playwright
│   ├── api/                     # Testes de integração API + Supabase via Playwright
│   └── e2e/                     # Testes ponta a ponta no Chromium via Playwright
├── design-system.json           # Fonte única de tokens visuais e acessibilidade
├── playwright.config.ts
├── .env.example
├── .gitignore
├── CHANGELOG.md
└── README.md
```

---

## 2. Padrões Arquiteturais Implementados na Fase 1

1. **Separação App vs Server (`backend/app.js` / `backend/server.js`):** permite importar o app Express isoladamente e garante graceful shutdown fechando conexões do pool PostgreSQL em `SIGINT`/`SIGTERM`.
2. **Mapeamento Limpo Banco ↔ API (`dbMapper.js`):** todas as colunas em `snake_case` no Supabase são convertidas para `camelCase` nos DTOs da API.
3. **Segurança desde a Fundação:**
   - `helmet()` habilitado globalmente
   - `corsMiddleware` restrito a `FRONTEND_URL`
   - `rateLimiter` pronto para rotas de API e autenticação
   - Queries parametrizadas (`$1, $2...`) via `pg`
   - `.gitignore` protegendo `.env` e credenciais
4. **Design System & Acessibilidade (`design-system.json`):**
   - Tokens CSS em `frontend/src/styles/variables.css`
   - Foco visível com `--color-secondary` (`#3C7EFF`), skip link para conteúdo principal, alvos mínimos de `44px` e respeito a `prefers-reduced-motion`.

---

## 3. Evolução Arquitetural (Fases 2 e 3)

1. **Auth, RBAC Granular & Segurança (Fase 2):** `authService.js`, `tokenUtils.js`, `passwordPolicy.js`, `permissionService.js`, `authorize.js`, `auditMiddleware.js`, `securityAlertService.js`, `securityAnalyticsService.js`, `notificationService.js`, `exportService.js`, `retentionService.js` e `sanitizer.js`.
2. **CRUDs Core, Analytics & Configurações (Fase 3):**
   - **Domínio:** `companyService.js`, `jobOpeningService.js`, `candidateService.js`, `processService.js`, `userService.js`, `dashboardService.js` e `settingsService.js` (com respectivos controllers e validadores Joi).
   - **Utilitários Compartilhados:** `queryHelpers.js` (`parsePagination`, `SqlFilterBuilder`, `buildDynamicUpdate`, `handlePgError`), `csvParser.js` (parser RFC-4180 com autodetecção `,`/`;` e BOM) e `responseHelper.js` (`sendSuccess`, `actorMeta`).
   - **Integridade Transacional:** criação de candidatos com sub-recursos e processos seletivos em `withTransaction`, serialização de queries por cliente `pg` e leitura pós-`COMMIT`.
