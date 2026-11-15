# Arquitetura do Sistema — HR Hunter (v2.0)

**Versão:** 2.0 (Fase 1 — Fundação)  
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
│   ├── middleware/
│   │   ├── corsMiddleware.js    # CORS restritivo via FRONTEND_URL
│   │   ├── errorHandler.js      # Resposta padrão de erros com códigos customizados
│   │   └── rateLimiter.js       # Limite geral API e loginLimiter (5 req/15min)
│   ├── routes/
│   │   ├── health.js            # GET /api/v1/health
│   │   └── index.js             # Agregador /api/v1
│   ├── utils/
│   │   ├── dbMapper.js          # Conversão snake_case <-> camelCase e normalizações
│   │   ├── errorCodes.js        # Enum ErrorCodes e classe AppError
│   │   └── logger.js            # Winston structured logger
│   ├── app.js                   # App Express (exportável para testes/servidor)
│   ├── server.js                # Bootstrap HTTP + graceful shutdown (SIGINT/SIGTERM)
│   └── package.json
├── database/
│   ├── migrations/              # 001..007 SQL idempotentes para Supabase PostgreSQL
│   └── scripts/
│       ├── db.js                # Pool compartilhado para CLI/testes
│       ├── migrate.js           # Runner com controle SHA-256 em schema_migrations
│       ├── seed.js              # Seed idempotente (zero tabelas de domínio vazias)
│       └── inspect.js           # Auditoria de tabelas, views, triggers e funções
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DATA_MAPPING.md
│   ├── PLANO_MESTRE.md
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
