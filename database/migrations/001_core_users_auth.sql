-- =============================================================================
-- Migration 001: Core Users, Authentication & Login History
-- Target: Supabase (PostgreSQL 15/16+)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(50) PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL,
    checksum    VARCHAR(64),
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email                       VARCHAR(255) NOT NULL UNIQUE,
    password_hash               TEXT NOT NULL,
    full_name                   VARCHAR(255) NOT NULL,
    phone                       VARCHAR(30),
    role                        VARCHAR(50) NOT NULL
                                    CHECK (role IN ('Admin', 'Gerente', 'Recrutador', 'Consultor', 'GestorRH')),
    department                  VARCHAR(100),
    manager_id                  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    hiring_date                 TIMESTAMPTZ,
    preferred_language          VARCHAR(10) NOT NULL DEFAULT 'pt-BR'
                                    CHECK (preferred_language IN ('pt-BR', 'en-US')),
    last_login                  TIMESTAMPTZ,
    last_password_change        TIMESTAMPTZ,
    is_password_reset_required  BOOLEAN NOT NULL DEFAULT FALSE,
    login_attempts              INT NOT NULL DEFAULT 0,
    locked_until                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS ix_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS ix_users_manager   ON users(manager_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    ip_address  VARCHAR(50),
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS login_history (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    email_attempted VARCHAR(255),
    login_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_time     TIMESTAMPTZ,
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    is_successful   BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_login_history_user_id    ON login_history(user_id);
CREATE INDEX IF NOT EXISTS ix_login_history_login_time ON login_history(login_time DESC);
