# Documentação da API RESTful — HR Hunter (v2.0)

**Base URL:** `/api/v1`  
**Documentação Interativa Swagger:** `GET /api/docs` (`GET /api/docs.json`)  
**Última Atualização:** 2026-11-15 (Fase 2 — Auth, RBAC Granular & Segurança)  

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

## 7. Próximas Fases (Planejadas)
- **Fase 3:** CRUDs (`/companies`, `/job-openings`, `/candidates`, `/processes`, `/users`), Dashboard KPIs/Analytics e Settings/Backup lógico.
