-- =============================================================================
-- Migration 006: Settings, Email Templates, Audit, Permissions & Security
-- =============================================================================

CREATE TABLE IF NOT EXISTS configurations (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    config_key   VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT,
    data_type    VARCHAR(50) NOT NULL DEFAULT 'string',
    category     VARCHAR(100) NOT NULL DEFAULT 'General',
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_configurations_category ON configurations(category);

CREATE TABLE IF NOT EXISTS email_templates (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_key VARCHAR(100) NOT NULL UNIQUE,
    name         VARCHAR(255) NOT NULL,
    subject      VARCHAR(500) NOT NULL,
    body_html    TEXT NOT NULL,
    variables    JSONB NOT NULL DEFAULT '[]'::jsonb,
    language     VARCHAR(10) NOT NULL DEFAULT 'pt-BR'
                     CHECK (language IN ('pt-BR', 'en-US')),
    is_system    BOOLEAN NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(50) NOT NULL
                   CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'EXPORT', 'PERMISSION_CHANGE', 'RETENTION')),
    table_name VARCHAR(100),
    record_id  BIGINT,
    old_value  JSONB,
    new_value  JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS ix_audit_log_created_at ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS permissions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resource    VARCHAR(60) NOT NULL,
    action      VARCHAR(60) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
);

CREATE INDEX IF NOT EXISTS ix_permissions_resource ON permissions(resource);

CREATE TABLE IF NOT EXISTS role_permissions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role          VARCHAR(50) NOT NULL
                      CHECK (role IN ('Admin', 'Gerente', 'Recrutador', 'Consultor', 'GestorRH')),
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    updated_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permissions_role_perm UNIQUE (role, permission_id)
);

CREATE INDEX IF NOT EXISTS ix_role_permissions_role    ON role_permissions(role);
CREATE INDEX IF NOT EXISTS ix_role_permissions_perm_id ON role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS security_alerts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_type  VARCHAR(60) NOT NULL,
    severity    VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    user_email  VARCHAR(255),
    ip_address  VARCHAR(50),
    message     VARCHAR(500) NOT NULL,
    details     JSONB,
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'DISMISSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_security_alerts_status     ON security_alerts(status);
CREATE INDEX IF NOT EXISTS ix_security_alerts_severity   ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS ix_security_alerts_created_at ON security_alerts(created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS unauthorized_access_log (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    resource   VARCHAR(100) NOT NULL,
    action     VARCHAR(60) NOT NULL,
    endpoint   VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_unauth_log_user_id    ON unauthorized_access_log(user_id);
CREATE INDEX IF NOT EXISTS ix_unauth_log_created_at ON unauthorized_access_log(created_at DESC);

CREATE TABLE IF NOT EXISTS security_reports (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end   TIMESTAMPTZ NOT NULL,
    report_data  JSONB NOT NULL,
    risk_score   INT NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level   VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_security_reports_generated_at ON security_reports(generated_at DESC);

CREATE TABLE IF NOT EXISTS retention_execution_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    policy_summary  JSONB NOT NULL,
    records_deleted INT NOT NULL DEFAULT 0
);
