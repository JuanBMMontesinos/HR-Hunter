-- =============================================================================
-- Migration 007: PL/pgSQL Triggers, Views & Analytics / Workflow Functions
-- =============================================================================

-- 1. Generic updated_at trigger function
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'users',
        'recruitment_stage_template',
        'stage_funnels',
        'companies',
        'job_openings',
        'candidates',
        'candidate_experience',
        'candidate_education',
        'candidate_skills',
        'recruitment_processes',
        'process_stages',
        'offers',
        'configurations',
        'email_templates',
        'role_permissions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at_%I ON %I;', tbl, tbl);
        EXECUTE format(
            'CREATE TRIGGER trg_set_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- 2. Prevent deleting companies that still have open or in-progress job openings
CREATE OR REPLACE FUNCTION fn_prevent_delete_active_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM job_openings
        WHERE company_id = OLD.id
          AND status IN ('Aberta', 'Em Progresso')
    ) THEN
        RAISE EXCEPTION 'Não é possível deletar empresa com vagas ativas ou em progresso.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_active_company ON companies;
CREATE TRIGGER trg_prevent_delete_active_company
    BEFORE DELETE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_delete_active_company();

-- 3. Sync recruitment_processes current_stage_id and auto-complete on terminal stages
CREATE OR REPLACE FUNCTION fn_sync_process_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_terminal BOOLEAN;
BEGIN
    SELECT is_terminal
      INTO v_is_terminal
      FROM recruitment_stage_template
     WHERE id = NEW.stage_id;

    UPDATE recruitment_processes
       SET current_stage_id = NEW.stage_id,
           status = CASE WHEN COALESCE(v_is_terminal, FALSE) THEN 'Concluído' ELSE status END,
           end_date = CASE WHEN COALESCE(v_is_terminal, FALSE) THEN COALESCE(end_date, NOW()) ELSE end_date END,
           updated_at = NOW()
     WHERE id = NEW.process_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_process_stage ON process_stages;
CREATE TRIGGER trg_sync_process_stage
    AFTER INSERT ON process_stages
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_process_stage();

-- 4. Views
CREATE OR REPLACE VIEW vw_job_opening_summary AS
SELECT
    jo.id,
    jo.title,
    co.legal_name AS company_name,
    jo.department,
    jo.level,
    jo.status,
    jo.priority,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - jo.opened_at)) / 86400))::INT AS days_open,
    COUNT(DISTINCT rp.id)::INT AS total_candidates,
    SUM(CASE WHEN rp.status = 'Em Andamento' THEN 1 ELSE 0 END)::INT AS active_candidates,
    SUM(CASE WHEN rst.stage_name = 'Contratado' THEN 1 ELSE 0 END)::INT AS hired_candidates
FROM job_openings jo
INNER JOIN companies co ON jo.company_id = co.id
LEFT JOIN recruitment_processes rp ON jo.id = rp.job_opening_id
LEFT JOIN recruitment_stage_template rst ON rp.current_stage_id = rst.id
GROUP BY
    jo.id, jo.title, co.legal_name, jo.department,
    jo.level, jo.status, jo.priority, jo.opened_at;

CREATE OR REPLACE VIEW vw_candidate_summary AS
SELECT
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.status,
    COUNT(DISTINCT rp.id)::INT AS process_count,
    STRING_AGG(DISTINCT jo.title, ', ') AS applied_positions,
    STRING_AGG(DISTINCT rst.stage_name, ', ') AS current_stages
FROM candidates c
LEFT JOIN recruitment_processes rp ON c.id = rp.candidate_id
LEFT JOIN job_openings jo ON rp.job_opening_id = jo.id
LEFT JOIN recruitment_stage_template rst ON rp.current_stage_id = rst.id
GROUP BY c.id, c.full_name, c.email, c.phone, c.status;

CREATE OR REPLACE VIEW vw_recruitment_metrics AS
SELECT
    jo.company_id,
    co.legal_name AS company_name,
    COUNT(DISTINCT jo.id)::INT AS total_job_openings,
    COUNT(DISTINCT CASE WHEN jo.status IN ('Aberta', 'Em Progresso') THEN jo.id END)::INT AS active_job_openings,
    COUNT(DISTINCT rp.candidate_id)::INT AS total_candidates_applied,
    COUNT(DISTINCT CASE WHEN rp.status = 'Em Andamento' THEN rp.candidate_id END)::INT AS candidates_in_process,
    ROUND(AVG(EXTRACT(EPOCH FROM (rp.end_date - rp.start_date)) / 86400.0)::NUMERIC, 1) AS avg_process_days
FROM job_openings jo
INNER JOIN companies co ON jo.company_id = co.id
LEFT JOIN recruitment_processes rp ON jo.id = rp.job_opening_id
GROUP BY jo.company_id, co.legal_name;

-- 5. Stored Procedures converted to PostgreSQL Functions
CREATE OR REPLACE FUNCTION fn_get_dashboard_kpis(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date   TIMESTAMPTZ DEFAULT NULL,
    p_company_id BIGINT DEFAULT NULL,
    p_department VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    total_companies      BIGINT,
    active_job_openings  BIGINT,
    total_candidates     BIGINT,
    ongoing_processes    BIGINT,
    pending_offers       BIGINT,
    hired_count          BIGINT,
    new_job_openings     BIGINT,
    conversion_rate      NUMERIC,
    avg_days_to_fill     NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end   TIMESTAMPTZ := COALESCE(p_end_date, NOW());
    v_total_proc BIGINT;
    v_hired BIGINT;
BEGIN
    SELECT COUNT(*)
      INTO v_total_proc
      FROM recruitment_processes rp
      JOIN job_openings jo ON jo.id = rp.job_opening_id
     WHERE rp.created_at BETWEEN v_start AND v_end
       AND (p_company_id IS NULL OR jo.company_id = p_company_id)
       AND (p_department IS NULL OR jo.department = p_department);

    SELECT COUNT(*)
      INTO v_hired
      FROM recruitment_processes rp
      JOIN job_openings jo ON jo.id = rp.job_opening_id
      JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
     WHERE rst.stage_name = 'Contratado'
       AND rp.created_at BETWEEN v_start AND v_end
       AND (p_company_id IS NULL OR jo.company_id = p_company_id)
       AND (p_department IS NULL OR jo.department = p_department);

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM companies c WHERE c.status = 'Ativo' AND (p_company_id IS NULL OR c.id = p_company_id)),
        (SELECT COUNT(*) FROM job_openings jo WHERE jo.status IN ('Aberta', 'Em Progresso') AND (p_company_id IS NULL OR jo.company_id = p_company_id) AND (p_department IS NULL OR jo.department = p_department)),
        (SELECT COUNT(*) FROM candidates ca WHERE ca.status = 'Ativo'),
        (SELECT COUNT(*) FROM recruitment_processes rp JOIN job_openings jo ON jo.id = rp.job_opening_id WHERE rp.status = 'Em Andamento' AND (p_company_id IS NULL OR jo.company_id = p_company_id) AND (p_department IS NULL OR jo.department = p_department)),
        (SELECT COUNT(*) FROM offers o JOIN recruitment_processes rp ON rp.id = o.process_id JOIN job_openings jo ON jo.id = rp.job_opening_id WHERE o.status IN ('Enviada', 'Visualizada') AND (p_company_id IS NULL OR jo.company_id = p_company_id) AND (p_department IS NULL OR jo.department = p_department)),
        v_hired,
        (SELECT COUNT(*) FROM job_openings jo WHERE jo.created_at BETWEEN v_start AND v_end AND (p_company_id IS NULL OR jo.company_id = p_company_id) AND (p_department IS NULL OR jo.department = p_department)),
        CASE WHEN v_total_proc > 0 THEN ROUND((v_hired::NUMERIC / v_total_proc::NUMERIC) * 100.0, 2) ELSE 0 END,
        COALESCE(
            (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(jo.closed_at, NOW()) - jo.opened_at)) / 86400.0)::NUMERIC, 1)
               FROM job_openings jo
              WHERE jo.status = 'Preenchida'
                AND jo.opened_at BETWEEN v_start AND v_end
                AND (p_company_id IS NULL OR jo.company_id = p_company_id)
                AND (p_department IS NULL OR jo.department = p_department)),
            0
        );
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_candidates_by_stage(
    p_job_opening_id BIGINT DEFAULT NULL,
    p_company_id     BIGINT DEFAULT NULL
)
RETURNS TABLE (
    stage_id        BIGINT,
    stage_name      VARCHAR,
    stage_order     INT,
    candidate_count BIGINT,
    average_rating  NUMERIC
)
LANGUAGE sql
AS $$
    SELECT
        rst.id AS stage_id,
        rst.stage_name,
        rst.stage_order,
        COUNT(DISTINCT rp.id) AS candidate_count,
        ROUND(AVG(ps.rating)::NUMERIC, 2) AS average_rating
    FROM recruitment_stage_template rst
    LEFT JOIN recruitment_processes rp ON rp.current_stage_id = rst.id
    LEFT JOIN job_openings jo ON jo.id = rp.job_opening_id
    LEFT JOIN process_stages ps ON ps.process_id = rp.id AND ps.stage_id = rst.id
    WHERE rst.is_active = TRUE
      AND (p_job_opening_id IS NULL OR rp.job_opening_id = p_job_opening_id)
      AND (p_company_id IS NULL OR jo.company_id = p_company_id)
    GROUP BY rst.id, rst.stage_name, rst.stage_order
    ORDER BY rst.stage_order;
$$;

CREATE OR REPLACE FUNCTION fn_get_dashboard_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date   TIMESTAMPTZ DEFAULT NULL,
    p_company_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    chart_type TEXT,
    label      TEXT,
    total      BIGINT
)
LANGUAGE sql
AS $$
    WITH bounds AS (
        SELECT
            COALESCE(p_start_date, NOW() - INTERVAL '30 days') AS v_start,
            COALESCE(p_end_date, NOW()) AS v_end
    )
    SELECT 'CandidatesByDepartment'::TEXT AS chart_type,
           COALESCE(jo.department, 'Sem Departamento')::TEXT AS label,
           COUNT(DISTINCT rp.candidate_id) AS total
      FROM recruitment_processes rp
      JOIN job_openings jo ON jo.id = rp.job_opening_id
      CROSS JOIN bounds b
     WHERE rp.created_at BETWEEN b.v_start AND b.v_end
       AND (p_company_id IS NULL OR jo.company_id = p_company_id)
     GROUP BY COALESCE(jo.department, 'Sem Departamento')

    UNION ALL

    SELECT 'JobStatusDistribution'::TEXT,
           jo.status::TEXT,
           COUNT(*)
      FROM job_openings jo
      CROSS JOIN bounds b
     WHERE jo.created_at BETWEEN b.v_start AND b.v_end
       AND (p_company_id IS NULL OR jo.company_id = p_company_id)
     GROUP BY jo.status

    UNION ALL

    SELECT 'CandidateEvolution'::TEXT,
           TO_CHAR(ca.created_at, 'YYYY-MM-DD')::TEXT,
           COUNT(*)
      FROM candidates ca
      CROSS JOIN bounds b
     WHERE ca.created_at BETWEEN b.v_start AND b.v_end
     GROUP BY TO_CHAR(ca.created_at, 'YYYY-MM-DD')
     ORDER BY chart_type, label;
$$;

CREATE OR REPLACE FUNCTION fn_get_critical_processes(
    p_company_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    critical_type   TEXT,
    job_opening_id  BIGINT,
    title           VARCHAR,
    company_name    VARCHAR,
    days_elapsed    INT,
    candidate_count BIGINT
)
LANGUAGE sql
AS $$
    SELECT
        'Vaga Aberta Há Longo Tempo'::TEXT AS critical_type,
        jo.id AS job_opening_id,
        jo.title,
        co.legal_name AS company_name,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - jo.opened_at)) / 86400))::INT AS days_elapsed,
        COUNT(rp.id) AS candidate_count
    FROM job_openings jo
    INNER JOIN companies co ON jo.company_id = co.id
    LEFT JOIN recruitment_processes rp ON jo.id = rp.job_opening_id
    WHERE jo.status IN ('Aberta', 'Em Progresso')
      AND jo.opened_at < NOW() - INTERVAL '30 days'
      AND (p_company_id IS NULL OR jo.company_id = p_company_id)
    GROUP BY jo.id, jo.title, co.legal_name, jo.opened_at

    UNION ALL

    SELECT
        'Processo Parado'::TEXT AS critical_type,
        jo.id AS job_opening_id,
        jo.title,
        co.legal_name AS company_name,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ps.entered_at)) / 86400))::INT AS days_elapsed,
        1::BIGINT AS candidate_count
    FROM recruitment_processes rp
    INNER JOIN job_openings jo ON rp.job_opening_id = jo.id
    INNER JOIN companies co ON jo.company_id = co.id
    INNER JOIN process_stages ps ON rp.id = ps.process_id AND ps.exited_at IS NULL
    WHERE rp.status = 'Parado'
      AND ps.entered_at < NOW() - INTERVAL '15 days'
      AND (p_company_id IS NULL OR jo.company_id = p_company_id);
$$;

CREATE OR REPLACE FUNCTION fn_move_to_next_stage(
    p_process_id          BIGINT,
    p_new_stage_id        BIGINT,
    p_feedback            TEXT DEFAULT NULL,
    p_rating              INT DEFAULT NULL,
    p_responsible_user_id BIGINT DEFAULT NULL,
    p_attached_documents  JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
    success          BOOLEAN,
    process_stage_id BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_ps_id BIGINT;
    v_stage_name VARCHAR;
BEGIN
    UPDATE process_stages
       SET exited_at = NOW(),
           updated_at = NOW()
     WHERE process_id = p_process_id
       AND exited_at IS NULL;

    INSERT INTO process_stages (
        process_id, stage_id, feedback, rating, attached_documents, responsible_user_id
    )
    VALUES (
        p_process_id, p_new_stage_id, p_feedback, p_rating, COALESCE(p_attached_documents, '[]'::jsonb), p_responsible_user_id
    )
    RETURNING id INTO v_new_ps_id;

    SELECT stage_name INTO v_stage_name FROM recruitment_stage_template WHERE id = p_new_stage_id;

    INSERT INTO audit_log (user_id, action, table_name, record_id, new_value)
    VALUES (
        p_responsible_user_id,
        'UPDATE',
        'recruitment_processes',
        p_process_id,
        jsonb_build_object('currentStageId', p_new_stage_id, 'stageName', v_stage_name)
    );

    RETURN QUERY SELECT TRUE, v_new_ps_id;
END;
$$;
