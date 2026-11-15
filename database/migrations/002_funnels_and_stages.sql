-- =============================================================================
-- Migration 002: Recruitment Stage Templates & Stage Funnels
-- =============================================================================

CREATE TABLE IF NOT EXISTS recruitment_stage_template (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stage_name        VARCHAR(255) NOT NULL UNIQUE,
    stage_order       INT NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    requires_feedback BOOLEAN NOT NULL DEFAULT TRUE,
    is_terminal       BOOLEAN NOT NULL DEFAULT FALSE,
    description       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_stage_template_order  ON recruitment_stage_template(stage_order);
CREATE INDEX IF NOT EXISTS ix_stage_template_active ON recruitment_stage_template(is_active);

CREATE TABLE IF NOT EXISTS stage_funnels (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(500),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_stage_funnels_active  ON stage_funnels(is_active);
CREATE INDEX IF NOT EXISTS ix_stage_funnels_default ON stage_funnels(is_default);

CREATE TABLE IF NOT EXISTS stage_funnel_items (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    funnel_id   BIGINT NOT NULL REFERENCES stage_funnels(id) ON DELETE CASCADE,
    stage_id    BIGINT NOT NULL REFERENCES recruitment_stage_template(id) ON DELETE RESTRICT,
    stage_order INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stage_funnel_items_funnel_stage UNIQUE (funnel_id, stage_id),
    CONSTRAINT uq_stage_funnel_items_funnel_order UNIQUE (funnel_id, stage_order)
);

CREATE INDEX IF NOT EXISTS ix_stage_funnel_items_funnel ON stage_funnel_items(funnel_id);
CREATE INDEX IF NOT EXISTS ix_stage_funnel_items_stage  ON stage_funnel_items(stage_id);
