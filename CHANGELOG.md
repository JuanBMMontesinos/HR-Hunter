# Changelog

Todas as mudanças notáveis do projeto **HR Hunter** serão documentadas neste arquivo.

## [Unreleased]

### Added
- **Planejamento v2.0 (`docs/PLANO_MESTRE.md`):** Novo plano mestre migrando a especificação original (MSSQL/Cypress) para **Supabase (PostgreSQL)**, **Playwright** e governança contínua.
- **Skills do Workspace (`.agents/skills/`):**
  - `playwright-unit-testing` — Padrão de testes unitários de componentes, unit/API e E2E com Playwright.
  - `git-commit-push` — Fluxo seguro de commit e push para `https://github.com/JuanBMMontesinos/HR-Hunter`.
  - `docs-sync` — Regra contínua de sincronização entre código, schema e documentação.
- **Fundação do Repositório:** `.gitignore` (protegendo `.env`), `.env.example`, `design-system.json` e `README.md`.
- **Prompt Atualizado (`../PRDs/HR_Hunter_AI_Prompts_Supabase.md`):** Prompt completo v2.0 adaptado para Supabase PostgreSQL (migrations aplicadas pela IA via conexão direta ou MCP), Playwright e skills obrigatórias.
