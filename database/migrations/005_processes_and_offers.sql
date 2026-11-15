-- =============================================================================
-- Migration 005: Recruitment Processes, Process Stages & Offers
-- =============================================================================

CREATE TABLE IF NOT EXISTS recruitment_processes (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_opening_id   BIGINT NOT NULL REFERENCES job_openings(id) ON DELETE RESTRICT,
    candidate_id     BIGINT NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
    current_stage_id BIGINT NOT NULL REFERENCES recruitment_stage_template(id) ON DELETE RESTRICT,
    status           VARCHAR(50) NOT NULL DEFAULT 'Em Andamento'
                         CHECK (status IN ('Em Andamento', 'Parado', 'Concluído')),
    start_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date         TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_recruitment_processes_job_id        ON recruitment_processes(job_opening_id);
CREATE INDEX IF NOT EXISTS ix_recruitment_processes_candidate_id  ON recruitment_processes(candidate_id);
CREATE INDEX IF NOT EXISTS ix_recruitment_processes_stage_id      ON recruitment_processes(current_stage_id);
CREATE INDEX IF NOT EXISTS ix_recruitment_processes_status        ON recruitment_processes(status);
CREATE INDEX IF NOT EXISTS ix_recruitment_processes_job_candidate ON recruitment_processes(job_opening_id, candidate_id);

-- Prevents duplicate active processes for the same candidate and job opening
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_process_job_candidate
    ON recruitment_processes(job_opening_id, candidate_id)
    WHERE status IN ('Em Andamento', 'Parado');

CREATE TABLE IF NOT EXISTS process_stages (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    process_id          BIGINT NOT NULL REFERENCES recruitment_processes(id) ON DELETE CASCADE,
    stage_id            BIGINT NOT NULL REFERENCES recruitment_stage_template(id) ON DELETE RESTRICT,
    entered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exited_at           TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    feedback            TEXT,
    rating              INT CHECK (rating >= 1 AND rating <= 5),
    strengths           TEXT,
    weaknesses          TEXT,
    recommendation      VARCHAR(50)
                            CHECK (recommendation IN ('Avançar', 'Rejeitar', 'Em Dúvida')),
    attached_documents  JSONB NOT NULL DEFAULT '[]'::jsonb,
    responsible_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_process_stages_process_id    ON process_stages(process_id);
CREATE INDEX IF NOT EXISTS ix_process_stages_stage_id      ON process_stages(stage_id);
CREATE INDEX IF NOT EXISTS ix_process_stages_responsible   ON process_stages(responsible_user_id);
CREATE INDEX IF NOT EXISTS ix_process_stages_process_stage ON process_stages(process_id, stage_id);

CREATE TABLE IF NOT EXISTS offers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    process_id  BIGINT NOT NULL REFERENCES recruitment_processes(id) ON DELETE CASCADE,
    position    VARCHAR(255) NOT NULL,
    salary      NUMERIC(12,2),
    benefits    TEXT,
    start_date  DATE,
    conditions  TEXT,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at   TIMESTAMPTZ,
    response_at TIMESTAMPTZ,
    status      VARCHAR(50) NOT NULL DEFAULT 'Enviada'
                    CHECK (status IN ('Enviada', 'Visualizada', 'Aceita', 'Recusada')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_offers_process_id ON offers(process_id);
CREATE INDEX IF NOT EXISTS ix_offers_status     ON offers(status);
