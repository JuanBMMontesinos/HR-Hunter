# Guia de Setup — HR Hunter (v2.0)

**Stack:** React 18 + Vite + TypeScript · Node.js 18+ + Express · Supabase (PostgreSQL) · Playwright  

---

## 1. Pré-requisitos

- **Node.js:** 18+ (verificado com `v24.19.0`) e **npm** 10+
- **Git:** configurado para `https://github.com/JuanBMMontesinos/HR-Hunter`
- **Banco de Dados:** Projeto Supabase (`project_ref=fhhgtjzwmhgdiokqqebg`)
  - Conexão direta PostgreSQL (`db.fhhgtjzwmhgdiokqqebg.supabase.co:5432/postgres`, requer IPv6 ou Session Pooler IPv4 quando em redes sem IPv6)
  - Ou MCP Server `supabase-hr-hunter` configurado em `~/.gemini/config/mcp_config.json`

---

## 2. Instalação de Dependências

```bash
# Instala dependências da raiz (Playwright, pg, dotenv, bcrypt), backend e frontend
npm run install:all

# Instala o browser Chromium para os testes Playwright (E2E e Component Tests)
npx playwright install chromium
npx --prefix frontend playwright install chromium
```

---

## 3. Variáveis de Ambiente

Copie `.env.example` para `.env` na raiz do repositório (`HR-Hunter/.env`).  
**Nunca faça commit do arquivo `.env` nem exponha credenciais no Git.**

```env
NODE_ENV=development
PORT=3000
TZ=America/Sao_Paulo
LOG_LEVEL=info

# Use aspas simples se a senha contiver "$"
DATABASE_URL='postgresql://postgres:[DB_PASSWORD]@db.fhhgtjzwmhgdiokqqebg.supabase.co:5432/postgres'
DB_SSL=true
SUPABASE_URL=https://fhhgtjzwmhgdiokqqebg.supabase.co

FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000/api/v1

# Autenticação, Segurança & Retenção (Fase 2)
JWT_SECRET=replace_with_64_char_random_secret
JWT_REFRESH_SECRET=replace_with_another_64_char_random_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
ENABLE_RETENTION_CRON=false

# E-mail SMTP (opcional em desenvolvimento)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@hrhunter.com

PLAYWRIGHT_BASE_URL=http://localhost:5173
PLAYWRIGHT_API_URL=http://localhost:3000/api/v1
```

---

## 4. Migrations e Seed no Supabase

```bash
# Aplicar todas as migrations SQL (001 a 007)
npm run migrate

# Popular dados iniciais idempotentes (zero tabelas de domínio vazias)
npm run seed

# Executar migrations + seed em sequência
npm run db:setup

# Inspecionar objetos criados e contagem de linhas no Supabase
node database/scripts/inspect.js
```

---

## 5. Executando em Desenvolvimento

Em dois terminais separados:

```bash
# Terminal 1 — Backend Express (porta 3000)
npm run dev:backend

# Terminal 2 — Frontend Vite (porta 5173)
npm run dev:frontend
```

Endpoints principais disponíveis:
- **Frontend:** `http://localhost:5173`
- **Health Check (API + Supabase ping):** `http://localhost:3000/api/v1/health`
- **Swagger / OpenAPI (`68` paths / `95` operações documentadas):** `http://localhost:3000/api/docs`

---

## 6. Executando Testes e Build

```bash
# Testes Unitários de Backend/Domínio (Playwright)
npm run test:unit

# Testes de Integração API + Schema Supabase (Playwright)
npm run test:api

# Testes E2E no Browser (Playwright)
npm run test:e2e

# Todos os projetos Playwright (unit + api + e2e)
npm test

# Testes Unitários de Componentes React (Playwright CT)
npm run test:ct

# Typecheck e Build do Frontend
npm run typecheck:frontend
npm run build:frontend
```
