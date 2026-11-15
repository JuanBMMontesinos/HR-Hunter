# Segurança, Autenticação & Permissões RBAC — HR Hunter (v2.0)

**Última Atualização:** 2026-11-15  
**Escopo:** Fases 2, 4 e 5 — Auth JWT, Cookies HttpOnly, Bloqueio por Força Bruta, Matriz RBAC Granular, Alertas, Auditoria, Analytics, Retenção & Interface Administrativa de Segurança  

---

## 1. Arquitetura de Autenticação (`backend/services/authService.js`)

| Mecanismo | Implementação Atual | Referência |
|---|---|---|
| **Hash de Senha** | `bcrypt` (cost/salt factor `10`), nunca exposto em DTOs ou `audit_log` | `authService.js`, `auditService.js` |
| **Access Token (JWT)** | HMAC SHA-256 via `jsonwebtoken`, expiração configurável (`JWT_EXPIRES_IN=1h`), issuer `hr-hunter-api` | `backend/utils/tokenUtils.js` |
| **Refresh Token** | Token opaco de 48 bytes aleatórios (`crypto.randomBytes`), armazenado como hash SHA-256 em `refresh_tokens` e enviado exclusivamente em cookie `HttpOnly` (`hr_refresh_token`, `SameSite=Lax`, path `/api/v1/auth`) | `authController.js`, `tokenUtils.js` |
| **Rotação & Proteção contra Replay** | `POST /api/v1/auth/refresh-token` revoga o refresh token usado e emite um novo token em transação PostgreSQL; se um token já revogado for reapresentado, todas as sessões ativas do usuário são revogadas | `authService.refreshSession` |
| **Bloqueio de Conta (Lockout)** | Após `MaxLoginAttempts` (`5` padrão) senhas incorretas, define `locked_until` por `LockoutDuration` (`15` minutos), retorna HTTP `423 AUTH_004` e gera alerta `BRUTE_FORCE_LOCKOUT` (`MEDIUM`) em `security_alerts` | `authService.login` |
| **Redefinição de Senha** | `POST /auth/forgot-password` retorna mensagem genérica anti-enumeração e grava hash SHA-256 em `password_reset_tokens` (validade 1h); `POST /auth/reset-password` valida complexidade forte e revoga sessões anteriores | `backend/utils/passwordPolicy.js` |

### Política de Senha Forte (`passwordPolicy.js`)
- Comprimento mínimo configurável via `configurations.PasswordMinLength` (padrão mínimo: **8 caracteres**)
- Ao menos **1 letra maiúscula**, **1 letra minúscula**, **1 número** e **1 caractere especial**

---

## 2. Rate Limiting, Cabeçalhos e Sanitização

- **`helmet()`** habilitado globalmente em `backend/app.js`.
- **CORS Restritivo (`corsMiddleware.js`):** restrito à origem configurada em `FRONTEND_URL`.
- **Rate Limiters (`backend/middleware/rateLimiter.js`):**
  - `apiLimiter`: `100` req / janela (`RATE_LIMIT_WINDOW_MS`)
  - `loginLimiter`: `5` tentativas / `15` min por chave combinada `IP + email` (`429 AUTH_RATE_LIMIT`)
  - `exportLimiter`: `10` exportações / hora em `/api/v1/exports/*`
- **Sanitização & Proteção XSS/CSV (`backend/utils/sanitizer.js`):**
  - Remoção de tags perigosas (`<script>`, `<iframe>`, `<object>`, `<embed>`, etc.), handlers `on*=`, URIs `javascript:`/`vbscript:`
  - Proteção contra *CSV Formula Injection* (`escapeCsvCell`) escapando prefixos `=`, `+`, `-`, `@`, `\t`, `\r`.

---

## 3. RBAC Granular & Matriz de Permissões

### Recursos × Ações (`permissions` — 28 Permissões)
7 recursos (`companies`, `job_openings`, `candidates`, `processes`, `users`, `settings`, `dashboard`) × 4 ações (`create`, `read`, `update`, `delete`).

### Perfis (`role_permissions`)
| Role | Escopo Padrão (Seed) | Editável via UI/API? |
|---|---|---|
| **Admin** | Todas as 28 permissões | ❌ **Protegida** (`PUT /permissions/roles/Admin` retorna `403 FORBIDDEN`) |
| **Gerente** | `dashboard:read` + CRUD completo em `companies`, `job_openings`, `candidates`, `processes` | ✅ Sim |
| **Recrutador** | `dashboard:read`, `companies:read` + CRUD em `job_openings`, `candidates`, `processes` | ✅ Sim |
| **GestorRH** | `dashboard:read`, `companies:read`, `job_openings:read`, `candidates:read` + CRUD em `processes` | ✅ Sim |
| **Consultor** | `candidates:read`, `processes:read` | ✅ Sim |

### Cache & Consistência (`backend/services/permissionService.js`)
- Consultas de permissões utilizam cache em memória com **TTL de 5 minutos (`300s`)**.
- Toda alteração via `PUT /api/v1/permissions/roles/:role` roda dentro de `withTransaction`, registra evento `PERMISSION_CHANGE` em `audit_log` (com `old_value` e `new_value` JSONB) e chama `invalidateCache(role)` imediatamente.

---

## 4. Detecção de Acessos Não Autorizados & Alertas Automáticos

Quando `authorize(resource, action)` ou `requireAdmin` nega acesso (`403 FORBIDDEN`):
1. Grava registro detalhado em `unauthorized_access_log` (`user_id`, `user_email`, `resource`, `action`, `endpoint`, `ip_address`, `user_agent`).
2. Avalia limites na última 1 hora (`backend/services/securityAlertService.js`):
   - **≥ 5 tentativas/usuário/hora** → gera alerta `REPEATED_UNAUTHORIZED_USER` com severidade **`HIGH`** e notifica administradores ativos em `notifications`.
   - **≥ 10 tentativas/IP/hora** → gera alerta `SUSPICIOUS_IP_ACTIVITY` com severidade **`CRITICAL`** e notifica administradores ativos em `notifications`.

---

## 5. Analytics de Risco (`security_reports`) & Retenção (`node-cron`)

- **Risk Score (`0..100` — `securityAnalyticsService.js`):** calcula pontuação ponderada a partir de tentativas não autorizadas, falhas de login e alertas ativos por severidade, classificando em `LOW` (`< 25`), `MEDIUM` (`25–49`), `HIGH` (`50–74`) ou `CRITICAL` (`≥ 75`) com recomendações automáticas.
- **Políticas de Retenção (`retentionService.js`):**
  - Chaves configuráveis na tabela `configurations` (`category = 'Retention'`): `RetentionAuditLogDays` (90d), `RetentionUnauthorizedAccessDays` (180d), `RetentionLoginHistoryDays` (365d), `RetentionSecurityAlertsDays` (365d, preservando alertas `ACTIVE`), `RetentionNotificationsDays` (30d, apenas notificações lidas).
  - Limpa também `refresh_tokens` expirados/revogados antigos e `password_reset_tokens` expirados/usados.
  - Suporta simulação (`dryRun: true`), execução manual (`POST /api/v1/retention/execute`) e agendamento `node-cron` em `America/Sao_Paulo` (`ENABLE_RETENTION_CRON=true` / produção).

---

## 6. Segurança e RBAC no Frontend (Fase 4)

- **Armazenamento & Renovação de Tokens (`frontend/src/contexts/AuthContext.tsx`, `frontend/src/services/api.ts`):**
  - O access token JWT permanece apenas em memória React/ref (nunca em `localStorage`), enquanto a renovação silenciosa em reloads utiliza o cookie `HttpOnly` `hr_refresh_token`.
  - O interceptor de resposta `401` implementa fila única (`inFlightRefresh`) e ignora rotas públicas/auth (`/auth/login`, `/auth/refresh-token`, `/auth/forgot-password`, `/auth/reset-password`), impedindo detecção falsa de replay por requisições simultâneas.
- **Sincronização RBAC Sem Race Condition (`PermissionsContext.tsx`, `RoleProtectedRoute.tsx`):**
  - Enquanto `authLoading || permissionsLoading` ou `syncedUserKey !== currentUserKey`, rotas protegidas exibem `<Loader fullScreen />` sem redirecionar para `/access-denied`.
  - Navegação lateral (`Sidebar.tsx`) filtra os links dinamicamente com `can(resource, action)`.
- **Sanitização HTML Client-Side (`frontend/src/utils/sanitizer.ts`):**
  - `safeSetElementHtml` prioriza `Element.prototype.setHTML` nativo quando disponível e utiliza `dompurify` carregado sob demanda com `ALLOW_ARIA_ATTR: false`, `ALLOW_DATA_ATTR: false` e `KEEP_CONTENT: false` na pré-visualização do `RichTextEditor`.
- **Política de Senha & Formulários (`PasswordStrengthMeter.tsx`, `LoginForm.tsx`):**
  - Medidor interativo espelha as 5 regras de `backend/utils/passwordPolicy.js`, formulários empregam atributos padrão de gerenciadores de senha (`autocomplete="username"` / `"current-password"` / `"new-password"`) e tratam retornos `401`, `403`, `423 AUTH_004` e `429 AUTH_RATE_LIMIT`.

---

## 7. Controles de Segurança na Interface Administrativa (Fase 5 — `Settings`)

- **Mascaramento de Chaves Sensíveis (`GeneralSettingsTab.tsx`):**
  - Chaves marcadas com `isSensitive=true` são recebidas e exibidas com valor mascarado (`********`) na interface e enviadas apenas quando explicitamente alteradas pelo administrador, evitando sobrescrita acidental de segredos ou exposição em respostas JSON.
- **Matriz Interativa RBAC (`PermissionsManagerTab.tsx`):**
  - Permite editar permissões `7 recursos × 4 ações` para `Recrutador` e `Consultor` por meio de `/api/v1/permissions/roles/:role`, mantendo o perfil `Admin` bloqueado como somente leitura para impedir perda acidental de acesso administrativo.
  - Toda alteração dispara geração automática de evento `PERMISSION_CHANGE` no `audit_log` (inspecionável diretamente na própria aba e em `AuditLogTab.tsx`) e invalidação imediata do cache RBAC no servidor.
- **Painel de Segurança, Alertas e Relatórios (`SecurityDashboardTab.tsx` & `securityAdminService.ts`):**
  - Exibe alertas ativos de segurança com ações de resolução/descarte, pontuação de risco (`0..100`) via barra `<progress>` nativa acessível e atualização automática configurável (30s).
  - Exportações CSV/PDF (`/api/v1/exports/*`) e snapshots lógicos (`BackupSnapshotTab.tsx`, `/api/v1/settings/backup`) são baixados via `apiClient` autenticado (`responseType: 'blob'`), sem exposição de tokens em URLs ou query strings.
- **Retenção e Reset Forçado de Senha (`SecurityAndRetentionTab.tsx` & `UsersPage.tsx`):**
  - Permite configurar políticas de retenção, consultar registros elegíveis, simular com `Dry-Run` ou executar expurgos auditados em `retention_execution_log`; administradores podem realizar reset de senha de outros usuários respeitando validação da política de força (`PasswordStrengthMeter.tsx`).
- Documentação completa das 9 abas: [SETTINGS_MODULE.md](./SETTINGS_MODULE.md).
