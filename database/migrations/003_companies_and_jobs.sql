-- =============================================================================
-- Migration 003: Companies & Job Openings
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    legal_name    VARCHAR(255) NOT NULL,
    trade_name    VARCHAR(255),
    cnpj          VARCHAR(20) NOT NULL UNIQUE,
    sector        VARCHAR(100),
    street        VARCHAR(255),
    number        VARCHAR(20),
    complement    VARCHAR(255),
    city          VARCHAR(100),
    state         VARCHAR(50),
    country       VARCHAR(100) NOT NULL DEFAULT 'Brasil',
    postal_code   VARCHAR(20),
    phone         VARCHAR(30),
    email         VARCHAR(255),
    website       VARCHAR(255),
    contact_name  VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    notes         TEXT,
    status        VARCHAR(50) NOT NULL DEFAULT 'Ativo'
                      CHECK (status IN ('Ativo', 'Inativo')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_companies_cnpj   ON companies(cnpj);
CREATE INDEX IF NOT EXISTS ix_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS ix_companies_sector ON companies(sector);

CREATE TABLE IF NOT EXISTS job_openings (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    funnel_id           BIGINT REFERENCES stage_funnels(id) ON DELETE SET NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    department          VARCHAR(100),
    level               VARCHAR(50)
                            CHECK (level IN ('Estagiário', 'Júnior', 'Pleno', 'Sênior', 'Especialista')),
    contract_type       VARCHAR(50)
                            CHECK (contract_type IN ('CLT', 'PJ', 'Temporário', 'Estágio')),
    regime              VARCHAR(50)
                            CHECK (regime IN ('Presencial', 'Híbrido', 'Remoto')),
    min_salary          NUMERIC(12,2),
    max_salary          NUMERIC(12,2),
    quantity_needed     INT NOT NULL DEFAULT 1 CHECK (quantity_needed >= 1),
    required_skills     TEXT,
    desired_skills      TEXT,
    benefits            TEXT,
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    planned_closed_at   TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    closed_reason       TEXT,
    responsible_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'Aberta'
                            CHECK (status IN ('Aberta', 'Em Progresso', 'Preenchida', 'Cancelada')),
    priority            VARCHAR(50) NOT NULL DEFAULT 'Média'
                            CHECK (priority IN ('Alta', 'Média', 'Baixa')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_job_openings_company_id     ON job_openings(company_id);
CREATE INDEX IF NOT EXISTS ix_job_openings_funnel_id      ON job_openings(funnel_id);
CREATE INDEX IF NOT EXISTS ix_job_openings_status         ON job_openings(status);
CREATE INDEX IF NOT EXISTS ix_job_openings_responsible    ON job_openings(responsible_user_id);
CREATE INDEX IF NOT EXISTS ix_job_openings_company_status ON job_openings(company_id, status);
CREATE INDEX IF NOT EXISTS ix_job_openings_fts
    ON job_openings USING GIN (to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(description, '')));
