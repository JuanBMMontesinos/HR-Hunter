-- =============================================================================
-- Migration 004: Candidates, Experience, Education & Skills
-- =============================================================================

CREATE TABLE IF NOT EXISTS candidates (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name        VARCHAR(255) NOT NULL,
    email            VARCHAR(255) NOT NULL UNIQUE,
    phone            VARCHAR(30),
    cpf              VARCHAR(15),
    date_birth       DATE,
    gender           VARCHAR(50)
                         CHECK (gender IN ('Masculino', 'Feminino', 'Outro', 'Prefiro não responder')),
    street           VARCHAR(255),
    number           VARCHAR(20),
    complement       VARCHAR(255),
    city             VARCHAR(100),
    state            VARCHAR(50),
    country          VARCHAR(100) NOT NULL DEFAULT 'Brasil',
    postal_code      VARCHAR(20),
    linkedin         VARCHAR(255),
    github           VARCHAR(255),
    portfolio        VARCHAR(255),
    cv_file_path     TEXT,
    desired_position VARCHAR(255),
    desired_salary   NUMERIC(12,2),
    available_date   DATE,
    notes            TEXT,
    status           VARCHAR(50) NOT NULL DEFAULT 'Ativo'
                         CHECK (status IN ('Ativo', 'Inativo', 'Bloqueado')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_candidates_email        ON candidates(email);
CREATE INDEX IF NOT EXISTS ix_candidates_status       ON candidates(status);
CREATE INDEX IF NOT EXISTS ix_candidates_status_email ON candidates(status, email);

-- Partial unique index: allows multiple candidates with NULL or empty CPF
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_cpf_not_null
    ON candidates(cpf)
    WHERE cpf IS NOT NULL AND cpf <> '';

CREATE TABLE IF NOT EXISTS candidate_experience (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    company      VARCHAR(255) NOT NULL,
    position     VARCHAR(255) NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE,
    description  TEXT,
    skills       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_candidate_experience_candidate_id ON candidate_experience(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_education (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    candidate_id    BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    institution     VARCHAR(255) NOT NULL,
    course          VARCHAR(255) NOT NULL,
    level           VARCHAR(50)
                        CHECK (level IN ('Técnico', 'Graduação', 'Pós-Graduação', 'Mestrado', 'Doutorado')),
    year_conclusion INT,
    status          VARCHAR(50)
                        CHECK (status IN ('Cursando', 'Concluído')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_candidate_education_candidate_id ON candidate_education(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_skills (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    skill        VARCHAR(255) NOT NULL,
    level        VARCHAR(50) NOT NULL DEFAULT 'Intermediário'
                     CHECK (level IN ('Iniciante', 'Intermediário', 'Avançado', 'Especialista')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_candidate_skills_candidate_id ON candidate_skills(candidate_id);
