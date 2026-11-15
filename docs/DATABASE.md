# Documentação do Banco de Dados — HR Hunter (Supabase / PostgreSQL)

**Versão:** 2.0  
**Projeto Supabase (`project_ref`):** `fhhgtjzwmhgdiokqqebg`  
**Host:** `db.fhhgtjzwmhgdiokqqebg.supabase.co:5432/postgres`  
**Engine:** PostgreSQL 15/16+ (Supabase Managed)  

---

## 1. Visão Geral

O banco de dados do HR Hunter utiliza **PostgreSQL no Supabase**, migrado da especificação original MSSQL 2025 com melhorias estruturais:
- **Nomenclatura:** `snake_case` em todas as tabelas, colunas, índices, views, triggers e funções.
- **Chaves Primárias:** `BIGINT GENERATED ALWAYS AS IDENTITY`.
- **Timestamps:** `TIMESTAMPTZ NOT NULL DEFAULT NOW()` com trigger automático para `updated_at`.
- **CPF Opcional Único:** Índice único parcial `uq_candidates_cpf_not_null` (`WHERE cpf IS NOT NULL AND cpf <> ''`) permitindo múltiplos candidatos sem CPF.
- **Estruturas JSON:** Uso nativo de `JSONB` em `audit_log`, `process_stages.attached_documents`, `email_templates.variables`, `security_alerts.details`, `security_reports.report_data` e `retention_execution_log.policy_summary`.

---

## 2. Histórico de Migrations (`database/migrations/`)

| Versão | Arquivo | Escopo |
|---|---|---|
| `001` | `001_core_users_auth.sql` | `schema_migrations`, `users`, `refresh_tokens`, `password_reset_tokens`, `login_history` |
| `002` | `002_funnels_and_stages.sql` | `recruitment_stage_template`, `stage_funnels`, `stage_funnel_items` |
| `003` | `003_companies_and_jobs.sql` | `companies`, `job_openings` (com índice GIN full-text) |
| `004` | `004_candidates.sql` | `candidates`, `candidate_experience`, `candidate_education`, `candidate_skills` |
| `005` | `005_processes_and_offers.sql` | `recruitment_processes`, `process_stages`, `offers` |
| `006` | `006_settings_email_audit_security.sql` | `configurations`, `email_templates`, `audit_log`, `permissions`, `role_permissions`, `security_alerts`, `notifications`, `unauthorized_access_log`, `security_reports`, `retention_execution_log` |
| `007` | `007_triggers_views_functions.sql` | Triggers, Views e Funções PL/pgSQL |

### Comandos de Execução

```bash
# Aplicar todas as migrations pendentes no Supabase
npm run migrate

# Executar seed idempotente inicial (zero tabelas de domínio vazias)
npm run seed

# Migrations + Seed em sequência
npm run db:setup

# Inspecionar tabelas, views, triggers, funções e contagens no Supabase
node database/scripts/inspect.js
```

---

## 3. Tabelas Criadas (27 Tabelas)

### Autenticação & Usuários
- **`schema_migrations`**: controle de versão e checksum SHA-256 das migrations aplicadas.
- **`users`**: usuários do sistema (`Admin`, `Gerente`, `Recrutador`, `Consultor`, `GestorRH`), controle de lockout (`login_attempts`, `locked_until`), idioma preferido (`pt-BR`/`en-US`) e `password_hash` (bcrypt).
- **`refresh_tokens`**: armazenamento seguro de hashes de refresh tokens com revogação (`revoked_at`).
- **`password_reset_tokens`**: tokens de redefinição de senha de uso único (`used_at`, `expires_at`).
- **`login_history`**: histórico de tentativas de login (bem-sucedidas ou falhas, inclusive para emails inexistentes via `email_attempted`).

### Funis & Etapas
- **`recruitment_stage_template`**: catálogo mestre das etapas (`stage_name`, `stage_order`, `requires_feedback`, `is_terminal`).
- **`stage_funnels`**: definição de funis reutilizáveis (`Funil Padrão Completo`, `Funil Ágil Tech`).
- **`stage_funnel_items`**: vínculo ordenado (`stage_order`) entre funis e etapas.

### Empresas & Vagas
- **`companies`**: clientes/empresas (`legal_name`, `trade_name`, `cnpj` único, endereço, contato principal, `status` `Ativo`/`Inativo`).
- **`job_openings`**: vagas vinculadas a `companies` e `stage_funnels`, faixa salarial (`min_salary`, `max_salary`), `quantity_needed`, `opened_at`, `planned_closed_at`, `status` (`Aberta`, `Em Progresso`, `Preenchida`, `Cancelada`) e `priority` (`Alta`, `Média`, `Baixa`).

### Candidatos
- **`candidates`**: cadastro completo de candidatos com `email` único e `cpf` opcional (índice único parcial `uq_candidates_cpf_not_null`).
- **`candidate_experience`**: histórico profissional (`ON DELETE CASCADE`).
- **`candidate_education`**: formação acadêmica (`ON DELETE CASCADE`).
- **`candidate_skills`**: competências e proficiência (`ON DELETE CASCADE`).

### Processos & Ofertas
- **`recruitment_processes`**: vínculo entre `job_openings` e `candidates`, com `current_stage_id` e índice único parcial `uq_active_process_job_candidate` impedindo duplicidade ativa (`Em Andamento`, `Parado`).
- **`process_stages`**: timeline detalhada de cada etapa percorrida (`entered_at`, `exited_at`, `feedback`, `rating` 1–5, `strengths`, `weaknesses`, `recommendation`, `attached_documents`).
- **`offers`**: propostas enviadas ao candidato (`position`, `salary`, `benefits`, `start_date`, `conditions`, `status`).

### Configurações, Auditoria & Segurança Avançada
- **`configurations`**: chave-valor tipada (`General`, `Localization`, `Theme`, `Security`, `Email`, `Retention`).
- **`email_templates`**: templates HTML com variáveis dinâmicas e proteção `is_system`.
- **`audit_log`**: trilha de auditoria (`old_value`, `new_value` em `JSONB`, `ip_address`, `user_agent`).
- **`permissions`**: 28 permissões granulares (7 recursos × 4 ações: `create`, `read`, `update`, `delete`).
- **`role_permissions`**: matriz associando cada role às permissões liberadas.
- **`security_alerts`**: alertas automáticos (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) com fluxo de resolução.
- **`notifications`**: notificações internas para usuários.
- **`unauthorized_access_log`**: log de tentativas de acesso negadas por RBAC.
- **`security_reports`**: relatórios consolidados com `risk_score` (0–100) e `risk_level`.
- **`retention_execution_log`**: histórico de execuções das políticas de retenção de dados.

---

## 4. Triggers, Views e Funções PL/pgSQL

### Triggers (17 Triggers)
- **`trg_set_updated_at_<tabela>`**: executado `BEFORE UPDATE` via `fn_set_updated_at()` em todas as 15 tabelas com coluna `updated_at`.
- **`trg_prevent_delete_active_company`**: executado `BEFORE DELETE` em `companies` via `fn_prevent_delete_active_company()`, impedindo exclusão quando existem vagas `Aberta` ou `Em Progresso`.
- **`trg_sync_process_stage`**: executado `AFTER INSERT` em `process_stages` via `fn_sync_process_stage()`, atualizando `current_stage_id` e concluindo automaticamente o processo quando a etapa possui `is_terminal = TRUE`.

### Views (3 Views)
- **`vw_job_opening_summary`**: resumo de vagas com dias em aberto e contadores de candidatos.
- **`vw_candidate_summary`**: resumo de candidatos com vagas aplicadas e etapas atuais agregadas.
- **`vw_recruitment_metrics`**: métricas agregadas por empresa cliente.

### Funções SQL (8 Rotinas PL/pgSQL)
- **Consultas & Fluxos de Negócio:**
  - **`fn_get_dashboard_kpis(p_start_date, p_end_date, p_company_id, p_department)`**
  - **`fn_get_candidates_by_stage(p_job_opening_id, p_company_id)`**
  - **`fn_get_dashboard_analytics(p_start_date, p_end_date, p_company_id)`**
  - **`fn_get_critical_processes(p_company_id)`**
  - **`fn_move_to_next_stage(p_process_id, p_new_stage_id, p_feedback, p_rating, p_responsible_user_id, p_attached_documents)`**
- **Trigger Functions (`database/migrations/007_triggers_views_functions.sql`):**
  - **`fn_set_updated_at()`** — atualiza `NEW.updated_at = NOW()` automaticamente nas 15 tabelas com triggers `trg_set_updated_at_*`.
  - **`fn_prevent_delete_active_company()`** — impede `DELETE` em `companies` quando há vagas com status `Aberta` ou `Em Progresso` (`trg_prevent_delete_active_company`).
  - **`fn_sync_process_stage()`** — sincroniza `current_stage_id` em `recruitment_processes` e conclui automaticamente processos em etapas terminais (`trg_sync_process_stage`).

---

## 6. Integração com API & Estratégia de Backup (Fase 3)

- **Consumo na API (`backend/services/`):**
  - `dashboardService.js` invoca diretamente `fn_get_dashboard_kpis`, `fn_get_dashboard_analytics` (3 parâmetros: `p_start_date`, `p_end_date`, `p_company_id`), `fn_get_candidates_by_stage`, `fn_get_critical_processes` e consulta a view `vw_recruitment_metrics`.
  - `processService.js` utiliza `fn_move_to_next_stage` nas transições de etapa (`/next-stage`, `/reject`, `/offer`, `/offer/:offerId`), disparando o trigger `trg_sync_process_stage` que conclui automaticamente processos em etapas terminais (`Contratado` / `Rejeitado`).
  - `jobOpeningService.js` utiliza `fn_get_candidates_by_stage` para detalhamento analítico por vaga (`/job-openings/:id/analytics`).
- **Backup Gerenciado + Snapshot Lógico:** além dos backups nativos gerenciados pela plataforma Supabase, administradores dispõem do endpoint `POST /api/v1/settings/backup` (`settingsService.js`) para extrair snapshots lógicos sob demanda em formato `json` ou `sql` (com trilha registrada em `audit_log`).
