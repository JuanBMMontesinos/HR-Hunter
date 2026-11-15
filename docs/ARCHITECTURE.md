# Arquitetura do Sistema — HR Hunter (v2.0)

**Versão:** 2.0 (Fase 6 — Docker, CI/CD, Proxy Reverso & Produção)  
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
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline GitHub Actions (lint, build, Docker, Playwright)
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
│   ├── Dockerfile               # Build multi-stage Node 24 Alpine (usuário non-root node)
│   ├── .dockerignore
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
│   ├── SETTINGS_MODULE.md
│   ├── SETUP.md
│   └── TESTING.md
├── frontend/
│   ├── playwright/              # Harness do Playwright Component Testing
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/            # LoginForm, PasswordStrengthMeter, PrivateRoute, RoleProtectedRoute
│   │   │   ├── common/          # Button, StatusBadge, LanguageSwitcher, PageHeader, Loader, Input, Select, Autocomplete, FilterBar, DataTable, Modal, Toast, RichTextEditor
│   │   │   └── layout/          # Header (notificações + menu usuário), Sidebar (desktop/mobile <dialog>), MainLayout
│   │   ├── contexts/            # AuthContext, PermissionsContext, ToastContext
│   │   ├── hooks/               # usePermissions
│   │   ├── i18n/                # react-i18next (pt-BR, en-US)
│   │   ├── pages/               # auth/*, dashboard/, companies/, job-openings/, candidates/, processes/, users/, profile/, settings/
│   │   ├── services/            # api.ts (single-flight 401), auth, company, jobOpening, candidate, process, user, dashboard, settings, securityAdmin
│   │   ├── styles/              # variables.css (design-system.json) + globals.css
│   │   ├── types/               # auth.ts, common.ts, domain.ts
│   │   ├── utils/               # passwordPolicy.ts, sanitizer.ts, stageTranslation.ts, formatters.ts
│   │   ├── App.tsx              # BrowserRouter + guards RBAC + ToastViewport
│   │   ├── main.tsx
│   │   └── vite-env.d.ts        # Tipagem ImportMetaEnv (VITE_API_BASE_URL)
│   ├── tests/ct/                # Testes unitários de componentes React (Playwright CT) + harnesses/
│   ├── Dockerfile               # Build estático Vite + runtime nginx:1.27-alpine
│   ├── .dockerignore
│   ├── nginx.conf               # Proxy reverso /api/ -> backend:3000 + fallback SPA + cache
│   ├── playwright-ct.config.ts
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── scripts/
│   └── verify.js                # Auditoria estática (sintaxe JS, SQL, segredos, docs e Swagger)
├── tests/
│   ├── unit/                    # Testes unitários via Playwright
│   ├── api/                     # Testes de integração API + Supabase via Playwright
│   └── e2e/                     # Testes ponta a ponta no Chromium via Playwright
├── design-system.json           # Fonte única de tokens visuais e acessibilidade
├── docker-compose.yml           # Orquestração frontend + backend (Supabase externo via .env)
├── .dockerignore
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

---

## 4. Arquitetura Frontend Base, Auth & RBAC (Fase 4)

1. **Cliente HTTP & Sessão (`services/api.ts`, `services/authService.ts`, `contexts/AuthContext.tsx`):**
   - `apiClient` configurado com `withCredentials: true` (enviando cookie `HttpOnly` `hr_refresh_token`), header automático `Authorization: Bearer`, agendamento proativo pré-expiração (45s antes de `exp`) e interceptor `401` single-flight para evitar replay durante rotação de tokens.
2. **RBAC Granular & Guarda Anti-Race Condition (`contexts/PermissionsContext.tsx`, `components/auth/RoleProtectedRoute.tsx`):**
   - `PermissionsContext` hidrata permissões via resposta inicial ou cache `localStorage` (`TTL 5 min`) e sincroniza `GET /api/v1/auth/permissions`.
   - `RoleProtectedRoute` bloqueia qualquer decisão de redirecionamento exibindo `<Loader />` enquanto `authLoading || permissionsLoading` forem verdadeiros, eliminando flashes falsos para `/access-denied`.
3. **Biblioteca de UI Acessível & Moderna (`components/common/`, `components/layout/`, `utils/sanitizer.ts`):**
   - Modais e gaveta móvel usam `<dialog>` nativo (`showModal()`, top-layer, `overscroll-behavior: contain` no `:modal` e `::backdrop`).
   - `DataTable` usa `@container (width < 600px)` para cards empilhados, `<th scope="col">` ordenáveis com `aria-sort` e anúncios `role="status"`.
   - `RichTextEditor` sanitiza HTML via `Element.prototype.setHTML` nativo quando suportado, com fallback para `dompurify`.
   - `stageTranslation.ts` traduz as 9 etapas padrão PT-BR ↔ EN-US preservando etapas customizadas intactas.

---

## 5. Camada de Aplicação Frontend — Módulos de Negócio, Kanban, Dashboard e Settings (Fase 5)

1. **Módulos Operacionais (`CompaniesPage`, `JobOpeningsPage`, `CandidatesPage`, `UsersPage`, `ProfilePage`):**
   - Listagens utilizam `FilterBar`, `DataTable` paginado (limite máximo de 20 registros/página respeitado em `companyService.ts`), `StatusBadge`, `ConfirmModal` e feedback imediato via `NotificationContext`.
   - `JobOpeningsPage` bloqueia edição estrutural quando a vaga atinge status `Preenchida` e oferece visualização detalhada em abas (`JobDetailsModal`: informações, candidatos e estatísticas).
   - `CandidatesPage` reúne formulário em abas (Dados Pessoais com CPF opcional, Experiências, Formação Acadêmica e Habilidades), importação em massa via CSV e vínculo direto com processos seletivos.
   - `UsersPage` integra `PasswordStrengthMeter` para criação/edição e reset administrativo de senha, além de inspeção de atividades (`ActivityModal`) e exclusão lógica; `ProfilePage` sincroniza a preferência de idioma em tempo real com `i18next`.

2. **Processos Seletivos (`ProcessesPage`, `ProcessKanban`, `ProcessDetailModal`):**
   - Alternância fluida entre visualização **Kanban** (padrão) e **Tabela**, com colunas dinâmicas traduzidas via `stageTranslation.ts` e isolamento de renderização por `content-visibility: auto` com `contain-intrinsic-size` (e fallback `@supports not` para navegadores legados).
   - Suporta movimentação híbrida: drag-and-drop nativo HTML5 e botões acessíveis de avanço/retorno por teclado em cada cartão, anunciando mudanças de posição exclusivamente quando ocorrem em região `role="status"`.
   - `ProcessDetailModal` concentra avaliação (1 a 5 estrelas), registro de proposta (`Offer`) com promoção automática para `Contratado` (`advanceToHired`), rejeição com justificativa e linha do tempo de transições.

3. **Dashboard Analítico (`DashboardPage`, `KpiCard`, `AccessibleCharts`, `CriticalProcessesCard`):**
   - Filtros globais de período, empresa e departamento atualizando 7 KPIs, Top 5 empresas contratantes, processos críticos e ações rápidas, com atualização automática opcional a cada 5 minutos.
   - Todos os 4 gráficos SVG responsivos dispõem de toggle interativo entre exibição visual (`Chart`) e tabela de dados acessível (`Table`) via leitor de tela e teclado.

4. **Configurações Administrativas (`SettingsPage` & `components/settings/*`):**
   - Arquitetura de 9 abas WAI-ARIA (`Tabs.tsx`) no modo `selectionMode="activation"`, evitando buscas HTTP até confirmação da aba ativa; detalhes completos em [SETTINGS_MODULE.md](./SETTINGS_MODULE.md).

---

## 6. Infraestrutura Docker, Proxy Reverso & CI/CD (Fase 6)

1. **Containerização Multi-Stage (`backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`):**
   - **Backend:** baseado em `node:24-alpine` com `npm ci --omit=dev`, executado sob `USER node`, com `HEALTHCHECK` usando `fetch` nativo do Node 24 em `http://127.0.0.1:3000/api/v1/health`.
   - **Frontend:** compila o bundle Vite no stage `builder` (`node:24-alpine`) injetando `VITE_API_BASE_URL` (padrão `/api/v1`) e serve os arquivos estáticos em `nginx:1.27-alpine`.
   - **Orquestração:** [`docker-compose.yml`](../docker-compose.yml) conecta apenas `backend` e `frontend` na rede `hr-hunter-net` (`enable_ipv6: true`, `depends_on: condition: service_healthy`), mapeando `FRONTEND_PORT` (padrão `8081`) sem banco local — apontando diretamente para o **Supabase** via `.env` (com suporte a IPv6 nativo ou IPv4 Session Pooler).
2. **Proxy Reverso & Estratégia de Cache (`frontend/nginx.conf`):**
   - Requests `/api/` são encaminhados para `http://backend:3000` com cabeçalhos `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto` e payload máximo de `10m`.
   - `/assets/` recebe cache imutável (`max-age=31536000, immutable`), `/index.html` usa `no-cache, no-store, must-revalidate` e demais rotas caem em `try_files $uri $uri/ /index.html;`.
3. **Observabilidade & Logging (`backend/utils/logger.js`):**
   - Winston estruturado em JSON (`timestamp`, `errors({ stack: true })`, `json()`) em `NODE_ENV=production` para ingestão em stdout/containers, e console colorido legível em `development`.
4. **Automação de Qualidade & Pipeline CI/CD (`scripts/verify.js`, `.github/workflows/ci.yml`):**
   - `scripts/verify.js` automatiza cinco checagens: sintaxe JS (`node --check`), integridade/proibição de sintaxe MSSQL nas migrations `.sql`, varredura de segredos em arquivos rastreados no Git, validação de links relativos em todos os Markdowns (`docs/*.md`, `README.md`, `CHANGELOG.md`) e integridade da spec OpenAPI (`OpenAPI 3.0.3`, `68` paths, `95` operações).
   - O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) executa `lint-build-and-audit`, `playwright-unit-and-ct` e `playwright-api-and-e2e` com upload dos relatórios Playwright como artifacts.
