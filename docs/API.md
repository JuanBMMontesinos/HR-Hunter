# Documentação da API RESTful — HR Hunter (v2.0)

**Base URL:** `/api/v1`  
**Documentação Interativa Swagger:** `GET /api/docs` (`GET /api/docs.json`) — OpenAPI `3.0.3` (`68` paths, `95` operações)  
**Última Atualização:** 2026-11-15 (Fase 6 — Docker, CI/CD, Proxy Reverso Nginx & Auditoria Final)  

---

## 1. Formato Padrão de Resposta

### Sucesso
```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-11-15T19:00:00.000Z"
}
```

### Erro
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001 | AUTH_002 | AUTH_003 | AUTH_004 | AUTH_005 | AUTH_006 | VAL_001 | VAL_004 | RES_001 | RATE_LIMIT | AUTH_RATE_LIMIT | SRV_001 | SRV_002",
    "message": "Mensagem descritiva",
    "details": []
  },
  "timestamp": "2026-11-15T19:00:00.000Z"
}
```

---

## 2. Sistema & Saúde

| Método | Rota | Auth / Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/health` | Pública | Verifica disponibilidade da API e latência do pool PostgreSQL no Supabase (`200` / `503`) |

---

## 3. Autenticação (`/api/v1/auth`)

| Método | Rota | Auth / Rate Limit | Descrição |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Pública · `loginLimiter` (`5` req/`15min` por IP+email) | Autentica `email` + `password`; retorna `accessToken` JWT (`1h`), `user`, `permissions` e define cookie `HttpOnly` `hr_refresh_token` (`7d`). Bloqueia conta após 5 erros (`423 AUTH_004`) |
| `POST` | `/api/v1/auth/refresh-token` | Cookie `hr_refresh_token` | Rotaciona refresh token opaco em transação e emite novo `accessToken`. Reuso de token revogado encerra todas as sessões (`401 AUTH_006`) |
| `POST` | `/api/v1/auth/logout` | Cookie e/ou Bearer opcional | Revoga `refresh_token`, fecha `logout_time` em `login_history`, grava `audit_log` (`LOGOUT`) e limpa cookie |
| `POST` | `/api/v1/auth/forgot-password` | Pública | Gera token único com hash SHA-256 em `password_reset_tokens` (validade `1h`) e dispara e-mail seguro sem vazar existência da conta |
| `POST` | `/api/v1/auth/reset-password` | Pública | Valida token + política de senha forte (`VAL_004`), atualiza hash bcrypt, revoga sessões ativas e grava `audit_log` (`PASSWORD_CHANGE`) |
| `GET` | `/api/v1/auth/permissions` | `authenticate` (Bearer JWT) | Retorna permissões efetivas da role do usuário (`ttlSeconds: 300`) |
| `GET` | `/api/v1/auth/me` | `authenticate` (Bearer JWT) | Retorna perfil sanitizado e permissões do usuário autenticado |

---

## 4. Permissões Granulares RBAC (`/api/v1/permissions`)

| Método | Rota | Auth / Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/permissions/matrix` | `authenticate` + `requireAdmin` | Lista 5 roles, 7 recursos, 4 ações, 28 permissões e matriz atual |
| `PUT` | `/api/v1/permissions/roles/:role` | `authenticate` + `requireAdmin` | Atualiza permissões de `Gerente`, `Recrutador`, `Consultor` ou `GestorRH` em transação + `audit_log` (`PERMISSION_CHANGE`) e invalida cache. Bloqueia edição de `Admin` (`403`) |
| `GET` | `/api/v1/permissions/audit-log` | `authenticate` + `requireAdmin` | Histórico paginado de alterações de permissões (`?userId=&action=&startDate=&endDate=&page=&limit=`) |

---

## 5. Alertas de Segurança & Notificações

### Alertas (`/api/v1/security-alerts`) — `authenticate` + `requireAdmin`
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/security-alerts` | Lista alertas paginados com filtros (`?status=&severity=&alertType=&startDate=&endDate=&page=&limit=`) |
| `GET` | `/api/v1/security-alerts/stats` | Totais por status, severidade ativa, tentativas não autorizadas (24h/7d) e top IPs/recursos |
| `PUT` | `/api/v1/security-alerts/:id/resolve` | Atualiza alerta para `RESOLVED` ou `DISMISSED` com `resolutionNote` opcional e grava `audit_log` |

### Notificações (`/api/v1/notifications`) — `authenticate`
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/notifications` | Lista notificações do usuário autenticado (`?unreadOnly=true&page=&limit=`) + `unreadCount` |
| `PUT` | `/api/v1/notifications/read-all` | Marca todas as notificações do usuário como lidas |
| `PUT` | `/api/v1/notifications/:id/read` | Marca notificação específica do usuário como lida (`404` se não pertencer ao usuário) |

---

## 6. Exportações, Analytics de Segurança & Retenção

### Exportações (`/api/v1/exports`) — `authenticate` + `requireAdmin` + `exportLimiter` (`10` req/`1h`)
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/exports/unauthorized-access-logs/csv` | CSV UTF-8 com BOM e delimitador `;` (com proteção contra *formula injection*) |
| `GET` | `/api/v1/exports/unauthorized-access-logs/pdf` | Relatório binário PDF (`application/pdf` via `pdfkit`) |
| `GET` | `/api/v1/exports/security-alerts/csv` | Exportação CSV UTF-8 (`;`) dos alertas de segurança |

### Analytics de Segurança (`/api/v1/analytics`) — `authenticate` + `requireAdmin`
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/analytics/generate-report` | Calcula `riskScore` (`0..100`), `riskLevel` e recomendações e persiste em `security_reports` (`201`) |
| `GET` | `/api/v1/analytics/reports` | Lista paginada dos relatórios gerados |
| `GET` | `/api/v1/analytics/reports/:id` | Detalhes de um relatório de segurança específico |

### Retenção de Dados (`/api/v1/retention`) — `authenticate` + `requireAdmin`
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/retention/policies` | Lista políticas da categoria `Retention` e contagem atual de registros elegíveis para expurgo |
| `PUT` | `/api/v1/retention/policies/:key` | Atualiza dias de retenção (`1` a `3650`) em `configurations` + `audit_log` |
| `POST` | `/api/v1/retention/execute` | Executa expurgo transacional (ou simulação com `{ "dryRun": true }`) e registra em `retention_execution_log` |
| `GET` | `/api/v1/retention/history` | Histórico paginado das execuções da política de retenção |

---

## 7. Empresas (`/api/v1/companies`)

| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/companies` | `companies:read` | Lista empresas paginadas (`limit <= 20`) com filtros por nome, status, setor e CNPJ |
| `POST` | `/api/v1/companies` | `companies:create` | Cadastra nova empresa validando CNPJ único (`409` em duplicidade) |
| `GET` | `/api/v1/companies/:id` | `companies:read` | Retorna detalhes da empresa e estatísticas de vagas/candidatos |
| `PUT` | `/api/v1/companies/:id` | `companies:update` | Atualiza dados cadastrais da empresa |
| `DELETE` | `/api/v1/companies/:id` | `companies:delete` | Inativa empresa (soft delete), bloqueando (`409`) se houver vagas abertas ou em progresso |

---

## 8. Vagas (`/api/v1/job-openings`)

| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/job-openings` | `job_openings:read` | Lista vagas paginadas com filtros por empresa, status, nível, departamento, contrato e busca |
| `POST` | `/api/v1/job-openings` | `job_openings:create` | Cria nova vaga (normaliza `salaryMin`/`minSalary`, `salaryMax`/`maxSalary`, `companyId`, `funnelId` e `openedAt`) |
| `GET` | `/api/v1/job-openings/:id` | `job_openings:read` | Retorna detalhes da vaga, etapas do funil e indicadores |
| `GET` | `/api/v1/job-openings/:id/candidates` | `job_openings:read` | Lista candidatos e processos vinculados à vaga |
| `GET` | `/api/v1/job-openings/:id/analytics` | `job_openings:read` | Retorna funil por etapa e métricas analíticas da vaga |
| `PUT` | `/api/v1/job-openings/:id` | `job_openings:update` | Atualiza vaga (bloqueia edição com `409` caso `status = 'Preenchida'`) |
| `DELETE` | `/api/v1/job-openings/:id` | `job_openings:delete` | Remove ou cancela vaga (bloqueia com `409` se houver processos ativos) |

---

## 9. Candidatos (`/api/v1/candidates`)

| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/candidates` | `candidates:read` | Lista candidatos paginados com filtros por nome, email, CPF, competência e status |
| `POST` | `/api/v1/candidates` | `candidates:create` | Cria candidato em transação (`cpf` opcional permitindo múltiplos `NULL`) e sub-recursos iniciais |
| `POST` | `/api/v1/candidates/import` | `candidates:create` | Importa candidatos em lote via CSV (`multipart/form-data` campo `file` ou JSON `{ csv }`, `,`/`;` e BOM) |
| `GET` | `/api/v1/candidates/:id` | `candidates:read` | Retorna perfil completo com experiências, formação acadêmica, competências e processos |
| `PUT` | `/api/v1/candidates/:id` | `candidates:update` | Atualiza dados cadastrais do candidato |
| `DELETE` | `/api/v1/candidates/:id` | `candidates:delete` | Inativa candidato (soft delete), bloqueando (`409`) se houver processo seletivo ativo |
| `GET/POST` | `/api/v1/candidates/:id/experience` | `candidates:read` / `update` | Lista ou adiciona experiência profissional ao candidato |
| `PUT/DELETE` | `/api/v1/candidates/:id/experience/:expId` | `candidates:update` | Atualiza ou remove experiência profissional do candidato |
| `GET/POST` | `/api/v1/candidates/:id/education` | `candidates:read` / `update` | Lista ou adiciona formação acadêmica ao candidato |
| `PUT/DELETE` | `/api/v1/candidates/:id/education/:eduId` | `candidates:update` | Atualiza ou remove formação acadêmica do candidato |
| `GET/POST` | `/api/v1/candidates/:id/skills` | `candidates:read` / `update` | Lista ou adiciona competência técnica ao candidato |
| `PUT/DELETE` | `/api/v1/candidates/:id/skills/:skillId` | `candidates:update` | Atualiza ou remove competência técnica do candidato |

---

## 10. Processos Seletivos, Kanban & Ofertas (`/api/v1/processes`)

| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/processes` | `processes:read` | Lista processos paginados com filtros por vaga, candidato, empresa, etapa e status |
| `GET` | `/api/v1/processes/kanban` | `processes:read` | Retorna colunas ordenadas do funil com processos agrupados para visão Kanban |
| `POST` | `/api/v1/processes` | `processes:create` | Inicia novo processo seletivo vinculando candidato e vaga na etapa inicial |
| `GET` | `/api/v1/processes/:id` | `processes:read` | Retorna detalhes do processo com histórico de etapas e propostas |
| `PUT` | `/api/v1/processes/:id` | `processes:update` | Atualiza status ou etapa de um processo seletivo |
| `POST` | `/api/v1/processes/:id/next-stage` | `processes:update` | Avança processo para próxima etapa via `fn_move_to_next_stage` com feedback, nota e anexos |
| `POST` | `/api/v1/processes/:id/reject` | `processes:update` | Rejeita candidato no processo com motivo e envio opcional de e-mail template |
| `POST` | `/api/v1/processes/:id/offer` | `processes:update` | Registra proposta salarial (`201`) e move processo para etapa `Oferta` |
| `PATCH` | `/api/v1/processes/:id/offer/:offerId` | `processes:update` | Atualiza status da proposta (`Aceita` com `advanceToHired` conclui processo como `Contratado`) |
| `GET` | `/api/v1/processes/:id/timeline` | `processes:read` | Retorna linha do tempo consolidada (etapas, propostas e auditoria) |

---

## 11. Usuários (`/api/v1/users`)

| Método | Endpoint | Acesso / Regra | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/users` | `Admin` | Lista usuários paginados com filtros por `role`, departamento e status |
| `POST` | `/api/v1/users` | `Admin` | Cria novo usuário aplicando política de senha forte |
| `GET` | `/api/v1/users/:id` | `Admin` ou próprio usuário | Retorna perfil do usuário |
| `PUT` | `/api/v1/users/:id` | `Admin` ou próprio usuário | `Admin` altera qualquer campo; próprio usuário altera apenas nome, telefone e idioma (`403` nos demais) |
| `DELETE` | `/api/v1/users/:id` | `Admin` | Desativa usuário (`is_active = false`) e revoga refresh tokens |
| `GET` | `/api/v1/users/:id/activity` | `Admin` ou próprio usuário | Histórico recente de logins e ações de auditoria |
| `POST` | `/api/v1/users/:id/reset-password` | `Admin` | Redefinição administrativa de senha com marcação opcional de troca no próximo login |

---

## 12. Dashboard Analítico (`/api/v1/dashboard`)

| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/kpis` | `dashboard:read` | KPIs consolidados executando `fn_get_dashboard_kpis` no Supabase |
| `GET` | `/api/v1/dashboard/analytics` | `dashboard:read` | Séries para gráficos (departamento, status de vagas, evolução 30d, etapas e top 5 empresas) |
| `GET` | `/api/v1/dashboard/critical-processes` | `dashboard:read` | Vagas abertas `> 30` dias e processos parados `> 15` dias via `fn_get_critical_processes` |

---

## 13. Configurações, Templates, Logs & Backup (`/api/v1/settings`)

| Método | Endpoint | Acesso / Regra | Descrição |
|---|---|---|---|
| `GET` | `/api/v1/settings` | `Admin` | Lista configurações do sistema mascarando chaves `is_sensitive` |
| `PUT` | `/api/v1/settings` | `Admin` | Atualiza configurações em transação com registro em `audit_log` |
| `GET/POST` | `/api/v1/settings/stages` | Autenticado / `Admin` | Lista ou cria etapa de processo seletivo |
| `PUT/DELETE` | `/api/v1/settings/stages/:id` | `Admin` | Atualiza ou remove etapa (bloqueia se possuir vínculos ativos) |
| `GET/POST` | `/api/v1/settings/funnels` | Autenticado / `Admin` | Lista funis configurados ou cria funil com associação ordenada de etapas |
| `PUT/DELETE` | `/api/v1/settings/funnels/:id` | `Admin` | Atualiza ou remove funil não padrão e sem vagas ativas |
| `GET/POST` | `/api/v1/settings/email-templates` | `Admin` | Lista ou cria template HTML sanitizado contra XSS |
| `PUT/DELETE` | `/api/v1/settings/email-templates/:id` | `Admin` | Atualiza template ou remove template customizado (protege `is_system = true` com `403`) |
| `POST` | `/api/v1/settings/email-test` | `Admin` | Dispara e-mail de teste SMTP ou em modo simulado seguro |
| `GET` | `/api/v1/settings/audit-log` | `Admin` | Lista `audit_log` paginado com filtros por usuário, ação, tabela e período |
| `GET` | `/api/v1/settings/login-history` | `Admin` | Lista `login_history` paginado com filtros por usuário, sucesso e período |
| `POST` | `/api/v1/settings/backup` | `Admin` | Gera snapshot lógico auditado (`json` ou `sql`) das tabelas de negócio |

---

## 14. Produção, Proxy Reverso Nginx & OpenAPI (Fase 6)
- **Especificação OpenAPI (`GET /api/docs` e `GET /api/docs.json`):** gerada dinamicamente por `backend/config/swagger.js` em formato `OpenAPI 3.0.3` (`68` paths / `95` operações), validada automaticamente por `npm run verify:swagger`.
- **Proxy Reverso (`frontend/nginx.conf`):** em produção Docker Compose, o container `frontend` (porta padrão `8081` mapeada para `80`) encaminha `/api/*` para `http://backend:3000`, preservando `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto`, com `client_max_body_size 10m`.
- **Trust Proxy & Cookies (`backend/app.js` / `backend/config/env.js`):** o Express utiliza `app.set('trust proxy', 1)` para manter precisão de IP no `rateLimiter` e `auditMiddleware` atrás do Nginx; o flag `Secure` do cookie `hr_refresh_token` (`httpOnly: true`, `sameSite: 'lax'`, path `/api/v1/auth`) é controlado por `COOKIE_SECURE` (`true` por padrão em `NODE_ENV=production`, podendo ser `false` apenas em teste HTTP local).
- **Frontends & CI/CD Integrados:** módulos Core (Fase 4), Kanban/Dashboard/Settings (Fase 5) e pipeline Docker + GitHub Actions (Fase 6) implementados e documentados em [ARCHITECTURE.md](./ARCHITECTURE.md) e [SETUP.md](./SETUP.md).
