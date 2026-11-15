# Mapeamento de Dados — HR Hunter (PostgreSQL ↔ API ↔ Frontend)

**Versão:** 2.0  
**Data:** 2026-11-15  

---

## 1. Convenção Única de Nomenclatura

Para eliminar inconsistências de mapeamento entre banco, API e interface:

| Camada | Convenção | Exemplo |
|---|---|---|
| **Supabase (PostgreSQL)** | `snake_case` | `full_name`, `company_id`, `opened_at`, `created_at` |
| **Backend Services / DTOs (`dbMapper.js`)** | `camelCase` | `fullName`, `companyId`, `openedAt`, `createdAt` |
| **Frontend (TypeScript / React)** | `camelCase` | `fullName`, `companyId`, `openedAt`, `createdAt` |

A conversão automática entre linhas do PostgreSQL (`snake_case`) e payloads JSON (`camelCase`) é feita pelos utilitários em `backend/utils/dbMapper.js` (`mapRow`, `mapRows`, `snakeToCamel`, `camelToSnake`, `normalizeOptionalString`).

---

## 2. Normalizações Críticas

1. **CPF Opcional (`candidates.cpf`):**
   - Strings vazias (`""`) recebidas pela API devem ser normalizadas para `NULL` via `normalizeOptionalString()`.
   - O índice único parcial `uq_candidates_cpf_not_null` garante unicidade apenas quando `cpf IS NOT NULL AND cpf <> ''`.
2. **Datas (`TIMESTAMPTZ` / `DATE`):**
   - API aceita e retorna strings ISO-8601 UTC (`2026-11-15T19:00:00.000Z`).
3. **Campos Salariais em Vagas (`job_openings`):**
   - Banco: `min_salary`, `max_salary`.
   - API/DTO canônico: `minSalary`, `maxSalary` (validadores Joi normalizam alias `salaryMin`/`salaryMax` caso enviado por clientes legados).
4. **Identificadores (`BIGINT`):**
   - Chaves primárias `BIGINT` são retornadas pelo driver `pg` como string ou número conforme parser; sempre converter/validar IDs numéricos positivamente nos validadores e DTOs.

---

## 3. Principais Entidades Mapeadas

### `users` ↔ `UserDTO`
- `id` ↔ `id`
- `email` ↔ `email`
- `full_name` ↔ `fullName`
- `phone` ↔ `phone`
- `role` ↔ `role`
- `department` ↔ `department`
- `manager_id` ↔ `managerId`
- `is_active` ↔ `isActive`
- `preferred_language` ↔ `preferredLanguage`
- `last_login` ↔ `lastLogin`
- `is_password_reset_required` ↔ `isPasswordResetRequired`
- *(Nota: `password_hash` nunca é exposto nos DTOs de resposta.)*

### `companies` ↔ `CompanyDTO`
- `legal_name` ↔ `legalName`, `trade_name` ↔ `tradeName`, `cnpj` ↔ `cnpj`, `sector` ↔ `sector`
- `street`, `number`, `complement`, `city`, `state`, `country`, `postal_code` (`postalCode`)
- `contact_name` (`contactName`), `contact_email` (`contactEmail`), `contact_phone` (`contactPhone`)
- `status` ↔ `status` (`Ativo` | `Inativo`)

### `job_openings` ↔ `JobOpeningDTO`
- `company_id` ↔ `companyId`, `funnel_id` ↔ `funnelId`, `responsible_user_id` ↔ `responsibleUserId`
- `title`, `description`, `department`, `level`, `contract_type` (`contractType`), `regime`
- `min_salary` (`minSalary`), `max_salary` (`maxSalary`), `quantity_needed` (`quantityNeeded`)
- `required_skills` (`requiredSkills`), `desired_skills` (`desiredSkills`), `benefits`
- `opened_at` (`openedAt`), `planned_closed_at` (`plannedClosedAt`), `closed_at` (`closedAt`), `closed_reason` (`closedReason`)
- `status` (`Aberta` | `Em Progresso` | `Preenchida` | `Cancelada`), `priority` (`Alta` | `Média` | `Baixa`)

### `candidates` ↔ `CandidateDTO`
- `full_name` (`fullName`), `email`, `phone`, `cpf`, `date_birth` (`dateBirth`), `gender`
- `desired_position` (`desiredPosition`), `desired_salary` (`desiredSalary`), `available_date` (`availableDate`)
- `cv_file_path` (`cvFilePath`), `linkedin`, `github`, `portfolio`, `notes`, `status`

---

## 4. Mapeamentos Adicionados nas Fases 3–6 (Processos, Ofertas, Funis, Configurações & Segurança)

### Normalização de Datas Joi → PostgreSQL (`backend/utils/dbMapper.js`)
O middleware `validationMiddleware.js` converte campos `Joi.date().iso()` (como `openedAt`, `startDate`, `endDate`, `scheduledAt`) para instâncias `Date` antes da camada de serviço. A função `normalizeOptionalString(value)` trata explicitamente `value instanceof Date`, convertendo datas válidas via `value.toISOString()` (e datas inválidas para `null`), evitando erros `22007` no PostgreSQL.

### Processos, Etapas & Ofertas (`recruitment_processes`, `process_stages`, `offers`)
- `job_opening_id` (`jobOpeningId`), `candidate_id` (`candidateId`), `current_stage_id` (`currentStageId`), `start_date` (`startDate`), `end_date` (`endDate`)
- `process_id` (`processId`), `stage_id` (`stageId`), `entered_at` (`enteredAt`), `exited_at` (`exitedAt`), `scheduled_at` (`scheduledAt`), `attached_documents` (`attachedDocuments`), `responsible_user_id` (`responsibleUserId`)
- `position`, `salary`, `benefits`, `conditions`, `sent_at` (`sentAt`), `viewed_at` (`viewedAt`), `response_at` (`responseAt`), `status`

### Templates de Etapa, Funis, E-mails & Configurações
- **Etapas (`recruitment_stage_template`):** `stage_name` (`stageName`), `stage_order` (`stageOrder`), `is_default` (`isDefault`), `is_terminal` (`isTerminal`)
- **Funis (`stage_funnels` / `stage_funnel_items`):** `funnel_id` (`funnelId`), `funnel_name` (`funnelName`), `is_default` (`isDefault`), `stage_id` (`stageId`), `stage_order` (`stageOrder`)
- **E-mail Templates (`email_templates`):** `template_key` (`templateKey`), `subject`, `body_html` (`bodyHtml`), `variables`, `is_active` (`isActive`), `is_system` (`isSystem`)
- **Configurações (`configurations`):** `config_key` (`configKey`), `config_value` (`configValue` — mascarada como `'********'` quando `is_sensitive = TRUE`), `description`, `category`, `is_sensitive` (`isSensitive`)

### Aliases de Contrato na API & Payloads JSONB
- **Vagas (`/api/v1/job-openings`):** `jobOpeningValidator.js` aceita `salaryMin`/`minSalary` e `salaryMax`/`maxSalary`, normalizando internamente para `minSalary`/`maxSalary` antes da persistência em `min_salary`/`max_salary`.
- **Relatórios de Segurança (`security_reports`):** a coluna JSONB `report_data` é mapeada no DTO raiz para `reportData` via `dbMapper.js` (`mapRow`/`mapRows`), preservando as chaves analíticas geradas em `securityAnalyticsService.js` (`failedLogins`, `activeAlertsBySeverity`, `recommendations`, etc.).
