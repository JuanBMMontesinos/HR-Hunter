# Módulo de Configurações Administrativas (`Settings`) — HR Hunter (v2.0)

**Rota Frontend:** `/settings` (`frontend/src/pages/settings/SettingsPage.tsx`)  
**Controle de Acesso:** Exclusivo para perfis com permissão `settings:read` (padrão seed: `Admin`)  
**Última Atualização:** 2026-11-15 (Fase F5)

---

## 1. Visão Geral das 9 Abas Administrativas

O módulo utiliza navegação por abas acessível (`frontend/src/components/common/Tabs.tsx`) no modo **`selectionMode="activation"`**: setas esquerda/direita movem o foco entre as abas sem disparar chamadas HTTP prematuras, e `Enter`/`Espaço`/clique ativam a aba selecionada carregando os dados sob demanda do Supabase via `/api/v1/settings/*`, `/api/v1/security-alerts/*`, `/api/v1/analytics/*`, `/api/v1/retention/*`, `/api/v1/permissions/*` e `/api/v1/exports/*`.

| # | Aba | Componente | Endpoints Principais | Funcionalidades |
|---|---|---|---|---|
| 1 | **Geral** | `GeneralSettingsTab.tsx` | `GET /settings`, `PUT /settings` | Edição de parâmetros gerais do sistema com mascaramento `********` em chaves `isSensitive` (chaves mascaradas não alteradas não sobrescrevem segredos reais). |
| 2 | **Etapas & Funis** | `StagesAndFunnelsTab.tsx` | `/settings/stages`, `/settings/funnels` | CRUD completo de etapas mestras (`requiresFeedback`, `isTerminal`, ordem) e montagem/ordenação (Subir/Descer) de funis customizados com marcação de funil padrão (`isDefault`). |
| 3 | **E-mail & Templates** | `EmailTemplatesTab.tsx` | `/settings`, `/settings/email-test`, `/settings/email-templates` | Configuração SMTP + disparo de e-mail de teste + editor `RichTextEditor` sanitizado para templates HTML com proteção contra exclusão (`403`) em templates `isSystem=true`. |
| 4 | **Segurança & Retenção** | `SecurityAndRetentionTab.tsx` | `/settings`, `/retention/policies`, `/retention/execute`, `/retention/history` | Políticas de senha/lockout (`PasswordMinLength`, `MaxLoginAttempts`, etc.), ajuste de janelas de retenção (dias), contagem de registros elegíveis, execução simulada (`Dry-Run`) ou definitiva e histórico `retention_execution_log`. |
| 5 | **Audit Log** | `AuditLogTab.tsx` | `GET /settings/audit-log` | Consulta paginada com filtros por tabela, ação e período, além de modal inspecionando JSON diff (`oldValue` × `newValue`). |
| 6 | **Login History** | `LoginHistoryTab.tsx` | `GET /settings/login-history` | Auditoria paginada de tentativas de autenticação (`isSuccessful`, motivo de falha, e-mail, IP e horário). |
| 7 | **Segurança (Alertas)** | `SecurityDashboardTab.tsx` | `/security-alerts/*`, `/analytics/*`, `/exports/*` | Painel de alertas ativos (`HIGH`/`CRITICAL`), tentativas `403` (24h/7d), pontuação de risco `0..100` em `<progress>` nativo, geração de `security_reports`, resolução/descarte de alertas, auto-refresh 30s e downloads autenticados CSV/PDF. |
| 8 | **Permissões** | `PermissionsManagerTab.tsx` | `/permissions/matrix`, `/permissions/roles/:role`, `/permissions/audit-log` | Matriz interativa `Role × Recurso × Ação (7×4)` com trava somente leitura obrigatória para o perfil `Admin` e registro automático `PERMISSION_CHANGE` em `audit_log`. |
| 9 | **Backup / Snapshot** | `BackupSnapshotTab.tsx` | `POST /settings/backup` | Orientação sobre backups automáticos gerenciados do Supabase e exportação de snapshot lógico auditado em **JSON** ou **SQL** com redação de segredos. |

---

## 2. Segurança e Boas Práticas Aplicadas

- **Downloads Autenticados (`securityAdminService.ts`):** arquivos CSV e PDF de `/api/v1/exports/*` e snapshots são baixados via `apiClient` (`Authorization: Bearer`) com `responseType: 'blob'`, garantindo que rotas protegidas nunca recebam links diretos não autenticados.
- **Invalidação de Cache RBAC:** ao salvar a matriz de um perfil em **Permissões**, `permissionService.js` invalida o cache em memória (TTL 5 min) transacionalmente e atualiza imediatamente as regras aplicadas pela API.
- **Acessibilidade (WCAG 2.1 AA):** abas `<button role="tab">` sem `aria-controls` redundante, painéis inativos com atributo `hidden`, indicador visual por borda inferior (compatível com Forced Colors Mode) e barra de risco semântica `<progress>` sem agrupamento incorreto de pseudo-elementos `-webkit-` / `-moz-`.
