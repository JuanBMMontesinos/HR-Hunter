# HR Hunter

Plataforma web de gestão de recrutamento e seleção (ATS/CRM) construída com **React + Vite + TypeScript**, **Node.js + Express**, **Supabase (PostgreSQL)** e suíte unificada de testes com **Playwright**.

> **Status Atual:** Planejamento v2.0 concluído (`F0`). O código da aplicação e as migrations no Supabase serão implementados a partir da Fase `F1` conforme [docs/PLANO_MESTRE.md](docs/PLANO_MESTRE.md).

## Stack Planejada

- **Frontend:** React 18+, Vite, TypeScript, CSS Variables (`design-system.json`), `react-i18next` (`pt-BR` / `en-US`)
- **Backend:** Node.js 18+, Express.js, `pg` (PostgreSQL), JWT + bcrypt, Joi, Helmet, Winston, Swagger/OpenAPI
- **Banco de Dados:** Supabase (PostgreSQL 15/16+, `project_ref=fhhgtjzwmhgdiokqqebg`)
- **Testes:** Playwright (`@playwright/test` para testes unitários/API/E2E e `@playwright/experimental-ct-react` para testes unitários de componentes)

## Estrutura Atual do Repositório

```text
HR-Hunter/
├── .agents/
│   └── skills/
│       ├── docs-sync/SKILL.md                 # Sincronização contínua de documentação
│       ├── git-commit-push/SKILL.md           # Fluxo seguro de commit/push para este repo
│       └── playwright-unit-testing/SKILL.md   # Padrão unificado de testes Playwright
├── docs/
│   └── PLANO_MESTRE.md                        # Plano mestre de arquitetura e roadmap (v2.0)
├── .env.example                               # Modelo de variáveis de ambiente (sem segredos)
├── .gitignore                                 # Proteção de .env, artefatos e dependências
├── CHANGELOG.md                               # Registro cronológico de mudanças
├── design-system.json                         # Tokens visuais e contrato de componentes
└── README.md                                  # Este arquivo
```

## Skills do Projeto (`.agents/skills/`)

1. **`playwright-unit-testing`** — Regras e comandos para testes unitários de componentes, testes unitários/integração de API e testes E2E com Playwright.
2. **`git-commit-push`** — Checklist de segurança (sem credenciais), qualidade e push para `https://github.com/JuanBMMontesinos/HR-Hunter`.
3. **`docs-sync`** — Garantia de que toda documentação permaneça 100% atualizada em relação ao código e ao banco de dados.

## Configuração Inicial (Variáveis de Ambiente)

1. Copie `.env.example` para `.env` (nunca versione o `.env`):
   ```bash
   cp .env.example .env
   ```
2. Preencha `DATABASE_URL` com a string de conexão do Supabase e os segredos JWT/SMTP.
3. Consulte os documentos em [`docs/PLANO_MESTRE.md`](docs/PLANO_MESTRE.md) para acompanhar o andamento das fases.

## Documentação

- [Plano Mestre de Arquitetura e Implementação](docs/PLANO_MESTRE.md)
- [Changelog](CHANGELOG.md)
- [Design System](design-system.json)
