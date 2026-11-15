const bcrypt = require('bcrypt');
const { createDbPool } = require('./db');

async function runSeed() {
  const pool = createDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Users (5 roles)
    const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'HrHunter@2026!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const seedUsers = [
      ['admin@hrhunter.com', 'Admin HR Hunter', '+55 11 99999-0001', 'Admin', 'Tecnologia'],
      ['gerente@hrhunter.com', 'Mariana Silva (Gerente)', '+55 11 99999-0002', 'Gerente', 'Recrutamento'],
      ['recruiter@hrhunter.com', 'Carlos Mendes (Recrutador)', '+55 11 99999-0003', 'Recrutador', 'Recrutamento'],
      ['consultor@hrhunter.com', 'Ana Costa (Consultora)', '+55 11 99999-0004', 'Consultor', 'Consultoria'],
      ['gestor@hrhunter.com', 'Roberto Alves (Gestor RH)', '+55 11 99999-0005', 'GestorRH', 'Recursos Humanos'],
    ];

    for (const [email, fullName, phone, role, department] of seedUsers) {
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role, department, is_active, hiring_date)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW() - INTERVAL '180 days')
         ON CONFLICT (email) DO NOTHING`,
        [email, passwordHash, fullName, phone, role, department]
      );
    }

    const adminRes = await client.query(`SELECT id FROM users WHERE email = 'admin@hrhunter.com'`);
    const recruiterRes = await client.query(`SELECT id FROM users WHERE email = 'recruiter@hrhunter.com'`);
    const adminId = adminRes.rows[0].id;
    const recruiterId = recruiterRes.rows[0].id;

    // 2. Recruitment Stage Templates
    const stages = [
      ['Candidatura Recebida', 1, false, false, 'Candidato se candidatou à vaga'],
      ['Triagem CV', 2, true, false, 'Análise inicial do currículo'],
      ['Entrevista Telefônica', 3, true, false, 'Entrevista inicial por telefone'],
      ['Entrevista Técnica', 4, true, false, 'Avaliação técnica de habilidades'],
      ['Dinâmica de Grupo', 5, true, false, 'Dinâmica de grupo ou apresentação'],
      ['Entrevista com Gestor', 6, true, false, 'Entrevista final com gestor'],
      ['Oferta', 7, false, false, 'Proposta enviada ao candidato'],
      ['Contratado', 8, false, true, 'Candidato aceito e contratado'],
      ['Rejeitado', 9, true, true, 'Candidato rejeitado'],
    ];

    for (const [name, order, reqFb, isTerm, desc] of stages) {
      await client.query(
        `INSERT INTO recruitment_stage_template (stage_name, stage_order, requires_feedback, is_terminal, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (stage_name) DO NOTHING`,
        [name, order, reqFb, isTerm, desc]
      );
    }

    // 3. Stage Funnels & Items
    await client.query(
      `INSERT INTO stage_funnels (name, description, is_active, is_default)
       VALUES
         ('Funil Padrão Completo', 'Funil padrão de 9 etapas para vagas corporativas e tecnologia', TRUE, TRUE),
         ('Funil Ágil Tech', 'Funil enxuto para contratações rápidas de engenharia', TRUE, FALSE)
       ON CONFLICT (name) DO NOTHING`
    );

    const defaultFunnelId = (await client.query(`SELECT id FROM stage_funnels WHERE name = 'Funil Padrão Completo'`)).rows[0].id;
    const techFunnelId = (await client.query(`SELECT id FROM stage_funnels WHERE name = 'Funil Ágil Tech'`)).rows[0].id;
    const allStages = (await client.query(`SELECT id, stage_name, stage_order FROM recruitment_stage_template ORDER BY stage_order`)).rows;

    for (const st of allStages) {
      await client.query(
        `INSERT INTO stage_funnel_items (funnel_id, stage_id, stage_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (funnel_id, stage_id) DO NOTHING`,
        [defaultFunnelId, st.id, st.stage_order]
      );
    }

    const agileStageNames = ['Candidatura Recebida', 'Triagem CV', 'Entrevista Técnica', 'Entrevista com Gestor', 'Oferta', 'Contratado', 'Rejeitado'];
    let agileOrder = 1;
    for (const name of agileStageNames) {
      const st = allStages.find((s) => s.stage_name === name);
      if (st) {
        await client.query(
          `INSERT INTO stage_funnel_items (funnel_id, stage_id, stage_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (funnel_id, stage_id) DO NOTHING`,
          [techFunnelId, st.id, agileOrder++]
        );
      }
    }

    // 4. Companies
    const seedCompanies = [
      ['TechNova Soluções Digitais Ltda', 'TechNova', '12.345.678/0001-90', 'Tecnologia', 'Av. Paulista', '1500', 'São Paulo', 'SP', '01310-200', '+55 11 3000-1000', 'contato@technova.com.br', 'https://technova.com.br', 'Fernanda Lima', 'fernanda@technova.com.br', 'Ativo'],
      ['FinCore Serviços Financeiros S.A.', 'FinCore', '23.456.789/0001-12', 'Financeiro', 'Rua Faria Lima', '2800', 'São Paulo', 'SP', '01451-000', '+55 11 3000-2000', 'rh@fincore.com.br', 'https://fincore.com.br', 'Lucas Rocha', 'lucas@fincore.com.br', 'Ativo'],
      ['VidaSaúde Diagnósticos Ltda', 'VidaSaúde', '34.567.890/0001-34', 'Saúde', 'Av. Rio Branco', '420', 'Rio de Janeiro', 'RJ', '20040-002', '+55 21 3000-3000', 'talentos@vidasaude.com.br', 'https://vidasaude.com.br', 'Paula Nogueira', 'paula@vidasaude.com.br', 'Ativo'],
    ];

    for (const c of seedCompanies) {
      await client.query(
        `INSERT INTO companies (legal_name, trade_name, cnpj, sector, street, number, city, state, postal_code, phone, email, website, contact_name, contact_email, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (cnpj) DO NOTHING`,
        c
      );
    }

    const techNovaId = (await client.query(`SELECT id FROM companies WHERE cnpj = '12.345.678/0001-90'`)).rows[0].id;
    const finCoreId = (await client.query(`SELECT id FROM companies WHERE cnpj = '23.456.789/0001-12'`)).rows[0].id;
    const vidaSaudeId = (await client.query(`SELECT id FROM companies WHERE cnpj = '34.567.890/0001-34'`)).rows[0].id;

    // 5. Job Openings (ensure idempotency via count check on seed titles)
    const existingJobsCount = Number((await client.query(`SELECT COUNT(*) FROM job_openings`)).rows[0].count);
    if (existingJobsCount === 0) {
      await client.query(
        `INSERT INTO job_openings (
           company_id, funnel_id, title, description, department, level, contract_type, regime,
           min_salary, max_salary, quantity_needed, required_skills, desired_skills, benefits,
           opened_at, planned_closed_at, responsible_user_id, status, priority
         ) VALUES
         ($1, $4, 'Engenheiro(a) Full-Stack Sênior', 'Desenvolvimento de plataforma web escalável em React e Node.js com Supabase.', 'Desenvolvimento', 'Sênior', 'CLT', 'Remoto', 14000, 18000, 2, 'React, TypeScript, Node.js, PostgreSQL', 'Playwright, Docker, AWS', 'VR, Plano de Saúde, Auxílio Home Office', NOW() - INTERVAL '40 days', NOW() + INTERVAL '20 days', $5, 'Aberta', 'Alta'),
         ($1, $4, 'Tech Recruiter Pleno', 'Condução de processos seletivos de ponta a ponta para times de tecnologia.', 'RH', 'Pleno', 'CLT', 'Híbrido', 6500, 8500, 1, 'Hunting, Triagem Técnica, Entrevistas por Competências', 'Inglês avançado, ATS', 'VR, Plano de Saúde, PLR', NOW() - INTERVAL '12 days', NOW() + INTERVAL '30 days', $5, 'Em Progresso', 'Média'),
         ($2, $3, 'Analista de Dados Financeiros', 'Modelagem SQL, ETL e criação de dashboards executivos.', 'Dados', 'Pleno', 'PJ', 'Híbrido', 9000, 12000, 1, 'PostgreSQL, Python, BI', 'Supabase, dbt', 'Horário flexível, Bônus anual', NOW() - INTERVAL '8 days', NOW() + INTERVAL '25 days', $5, 'Aberta', 'Média'),
         ($3, $3, 'Coordenador(a) de Operações Clínicas', 'Gestão operacional de unidades diagnósticas.', 'Operações', 'Especialista', 'CLT', 'Presencial', 12000, 15000, 1, 'Gestão Hospitalar, KPIs, Liderança', 'Lean Six Sigma', 'Plano de Saúde, Previdência Privada', NOW() - INTERVAL '45 days', NOW() - INTERVAL '5 days', $5, 'Preenchida', 'Alta')`,
        [techNovaId, finCoreId, defaultFunnelId, techFunnelId, recruiterId]
      );
    }

    // 6. Candidates (includes candidates WITHOUT CPF to prove partial unique index)
    const seedCandidates = [
      ['Gabriel Oliveira', 'gabriel.oliveira@example.com', '+55 11 98888-1111', '111.222.333-44', '1993-05-14', 'Masculino', 'São Paulo', 'SP', 'Engenheiro Full-Stack Sênior', 16000, 'Ativo'],
      ['Juliana Ferreira', 'juliana.ferreira@example.com', '+55 11 98888-2222', '222.333.444-55', '1995-09-21', 'Feminino', 'Campinas', 'SP', 'Analista de Dados', 10500, 'Ativo'],
      ['Lucas Martins', 'lucas.martins@example.com', '+55 21 98888-3333', null, '1998-02-10', 'Masculino', 'Rio de Janeiro', 'RJ', 'Desenvolvedor React Pleno', 9500, 'Ativo'],
      ['Beatriz Souza', 'beatriz.souza@example.com', '+55 31 98888-4444', null, '1991-11-03', 'Feminino', 'Belo Horizonte', 'MG', 'Tech Recruiter', 7500, 'Ativo'],
    ];

    for (const cand of seedCandidates) {
      await client.query(
        `INSERT INTO candidates (full_name, email, phone, cpf, date_birth, gender, city, state, desired_position, desired_salary, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (email) DO NOTHING`,
        cand
      );
    }

    const gabrielId = (await client.query(`SELECT id FROM candidates WHERE email = 'gabriel.oliveira@example.com'`)).rows[0].id;
    const julianaId = (await client.query(`SELECT id FROM candidates WHERE email = 'juliana.ferreira@example.com'`)).rows[0].id;
    const lucasId = (await client.query(`SELECT id FROM candidates WHERE email = 'lucas.martins@example.com'`)).rows[0].id;

    if (Number((await client.query(`SELECT COUNT(*) FROM candidate_experience`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO candidate_experience (candidate_id, company, position, start_date, end_date, description, skills) VALUES
         ($1, 'CloudBrasil Tech', 'Senior Software Engineer', '2022-01-10', NULL, 'Arquitetura de APIs Node.js e frontends React/TypeScript.', 'React, Node.js, PostgreSQL'),
         ($2, 'DataPay Analytics', 'Data Analyst', '2021-03-01', '2025-11-30', 'Pipelines SQL e modelagem analítica.', 'SQL, Python, PowerBI')`,
        [gabrielId, julianaId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM candidate_education`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO candidate_education (candidate_id, institution, course, level, year_conclusion, status) VALUES
         ($1, 'USP', 'Ciência da Computação', 'Graduação', 2016, 'Concluído'),
         ($2, 'UNICAMP', 'Estatística', 'Graduação', 2018, 'Concluído')`,
        [gabrielId, julianaId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM candidate_skills`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO candidate_skills (candidate_id, skill, level) VALUES
         ($1, 'TypeScript', 'Especialista'),
         ($1, 'PostgreSQL', 'Avançado'),
         ($2, 'SQL', 'Especialista'),
         ($3, 'React', 'Avançado')`,
        [gabrielId, julianaId, lucasId]
      );
    }

    // 7. Recruitment Processes, Process Stages & Offers
    const jobFullStackId = (await client.query(`SELECT id FROM job_openings WHERE title = 'Engenheiro(a) Full-Stack Sênior' LIMIT 1`)).rows[0].id;
    const jobDataId = (await client.query(`SELECT id FROM job_openings WHERE title = 'Analista de Dados Financeiros' LIMIT 1`)).rows[0].id;
    const stageTechId = allStages.find((s) => s.stage_name === 'Entrevista Técnica').id;
    const stageOfferId = allStages.find((s) => s.stage_name === 'Oferta').id;
    const stageAppliedId = allStages.find((s) => s.stage_name === 'Candidatura Recebida').id;

    if (Number((await client.query(`SELECT COUNT(*) FROM recruitment_processes`)).rows[0].count) === 0) {
      const p1 = (await client.query(
        `INSERT INTO recruitment_processes (job_opening_id, candidate_id, current_stage_id, status, start_date)
         VALUES ($1, $2, $3, 'Em Andamento', NOW() - INTERVAL '10 days') RETURNING id`,
        [jobFullStackId, gabrielId, stageOfferId]
      )).rows[0].id;

      const p2 = (await client.query(
        `INSERT INTO recruitment_processes (job_opening_id, candidate_id, current_stage_id, status, start_date)
         VALUES ($1, $2, $3, 'Parado', NOW() - INTERVAL '22 days') RETURNING id`,
        [jobDataId, julianaId, stageTechId]
      )).rows[0].id;

      await client.query(
        `INSERT INTO process_stages (process_id, stage_id, entered_at, feedback, rating, recommendation, responsible_user_id) VALUES
         ($1, $3, NOW() - INTERVAL '5 days', 'Excelente domínio técnico e aderência cultural.', 5, 'Avançar', $5),
         ($2, $4, NOW() - INTERVAL '18 days', 'Aguardando retorno da agenda do gestor técnico.', 4, 'Avançar', $5)`,
        [p1, p2, stageOfferId, stageTechId, recruiterId]
      );

      await client.query(
        `INSERT INTO offers (process_id, position, salary, benefits, start_date, conditions, status)
         VALUES ($1, 'Engenheiro(a) Full-Stack Sênior', 17000.00, 'VR + Plano de Saúde + Auxílio Home Office', CURRENT_DATE + 30, 'Regime CLT 100% remoto', 'Enviada')`,
        [p1]
      );

      // Keep stageAppliedId referenced nicely by inserting a third active candidate process
      const p3 = (await client.query(
        `INSERT INTO recruitment_processes (job_opening_id, candidate_id, current_stage_id, status, start_date)
         VALUES ($1, $2, $3, 'Em Andamento', NOW() - INTERVAL '2 days') RETURNING id`,
        [jobFullStackId, lucasId, stageAppliedId]
      )).rows[0].id;

      await client.query(
        `INSERT INTO process_stages (process_id, stage_id, entered_at, feedback, responsible_user_id)
         VALUES ($1, $2, NOW() - INTERVAL '2 days', 'Candidatura recebida via portal.', $3)`,
        [p3, stageAppliedId, recruiterId]
      );
    }

    // 8. Configurations
    const configs = [
      ['AppName', 'HR Hunter', 'string', 'General', false],
      ['DefaultLanguage', 'pt-BR', 'string', 'Localization', false],
      ['ThemePrimaryColor', '#F7941E', 'string', 'Theme', false],
      ['SessionTimeout', '30', 'int', 'Security', false],
      ['MaxLoginAttempts', '5', 'int', 'Security', false],
      ['LockoutDuration', '15', 'int', 'Security', false],
      ['PasswordMinLength', '8', 'int', 'Security', false],
      ['EmailSMTPHost', '', 'string', 'Email', false],
      ['EmailSMTPPort', '587', 'int', 'Email', false],
      ['EmailSMTPUser', '', 'string', 'Email', false],
      ['RetentionAuditLogDays', '90', 'int', 'Retention', false],
      ['RetentionUnauthorizedAccessDays', '180', 'int', 'Retention', false],
      ['RetentionLoginHistoryDays', '365', 'int', 'Retention', false],
      ['RetentionSecurityAlertsDays', '365', 'int', 'Retention', false],
      ['RetentionNotificationsDays', '30', 'int', 'Retention', false],
    ];

    for (const [key, val, dtype, cat, sens] of configs) {
      await client.query(
        `INSERT INTO configurations (config_key, config_value, data_type, category, is_sensitive)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (config_key) DO NOTHING`,
        [key, val, dtype, cat, sens]
      );
    }

    // 9. System Email Templates
    const templates = [
      [
        'candidate_rejection',
        'Rejeição de Candidato',
        'Atualização sobre sua candidatura para {{jobTitle}}',
        '<p>Olá {{candidateName}},</p><p>Agradecemos sua participação no processo seletivo para <strong>{{jobTitle}}</strong>. Neste momento seguiremos com outro perfil, mas manteremos seu currículo em nosso banco de talentos.</p>',
        JSON.stringify(['candidateName', 'jobTitle', 'companyName']),
        'pt-BR',
        true,
      ],
      [
        'job_offer',
        'Envio de Proposta',
        'Proposta de Trabalho — {{jobTitle}} na {{companyName}}',
        '<p>Olá {{candidateName}},</p><p>Temos o prazer de enviar a proposta para o cargo de <strong>{{jobTitle}}</strong> com remuneração de {{salary}}.</p>',
        JSON.stringify(['candidateName', 'jobTitle', 'companyName', 'salary', 'startDate']),
        'pt-BR',
        true,
      ],
      [
        'interview_confirmation',
        'Confirmação de Entrevista',
        'Entrevista agendada: {{jobTitle}}',
        '<p>Olá {{candidateName}},</p><p>Sua entrevista para a vaga <strong>{{jobTitle}}</strong> foi agendada para {{scheduledAt}}.</p>',
        JSON.stringify(['candidateName', 'jobTitle', 'scheduledAt']),
        'pt-BR',
        true,
      ],
    ];

    for (const [key, name, subject, body, vars, lang, isSys] of templates) {
      await client.query(
        `INSERT INTO email_templates (template_key, name, subject, body_html, variables, language, is_system)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (template_key) DO NOTHING`,
        [key, name, subject, body, vars, lang, isSys]
      );
    }

    // 10. Granular Permissions (28 permissions: 7 resources × 4 actions) & Role Matrix
    const resources = [
      ['companies', 'Empresas e clientes'],
      ['job_openings', 'Vagas de emprego'],
      ['candidates', 'Banco de candidatos'],
      ['processes', 'Processos seletivos e Kanban'],
      ['users', 'Usuários do sistema'],
      ['settings', 'Configurações e segurança'],
      ['dashboard', 'Dashboard e métricas'],
    ];
    const actions = ['create', 'read', 'update', 'delete'];

    for (const [resource, label] of resources) {
      for (const action of actions) {
        await client.query(
          `INSERT INTO permissions (resource, action, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (resource, action) DO NOTHING`,
          [resource, action, `${action.toUpperCase()} em ${label}`]
        );
      }
    }

    const permRows = (await client.query(`SELECT id, resource, action FROM permissions`)).rows;
    const permId = (res, act) => permRows.find((p) => p.resource === res && p.action === act)?.id;

    const roleMatrix = {
      Admin: permRows.map((p) => p.id),
      Gerente: [
        permId('dashboard', 'read'),
        ...actions.map((a) => permId('companies', a)),
        ...actions.map((a) => permId('job_openings', a)),
        ...actions.map((a) => permId('candidates', a)),
        ...actions.map((a) => permId('processes', a)),
      ],
      Recrutador: [
        permId('dashboard', 'read'),
        permId('companies', 'read'),
        ...actions.map((a) => permId('job_openings', a)),
        ...actions.map((a) => permId('candidates', a)),
        ...actions.map((a) => permId('processes', a)),
      ],
      Consultor: [
        permId('candidates', 'read'),
        permId('processes', 'read'),
      ],
      GestorRH: [
        permId('dashboard', 'read'),
        permId('companies', 'read'),
        permId('job_openings', 'read'),
        permId('candidates', 'read'),
        ...actions.map((a) => permId('processes', a)),
      ],
    };

    for (const [role, ids] of Object.entries(roleMatrix)) {
      for (const pid of ids.filter(Boolean)) {
        await client.query(
          `INSERT INTO role_permissions (role, permission_id, updated_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (role, permission_id) DO NOTHING`,
          [role, pid, adminId]
        );
      }
    }

    // 11. Baseline Audit, Security, Notification & Retention records (zero empty tables)
    if (Number((await client.query(`SELECT COUNT(*) FROM login_history`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO login_history (user_id, email_attempted, ip_address, user_agent, is_successful)
         VALUES ($1, 'admin@hrhunter.com', '127.0.0.1', 'HRHunter-Seed/2.0', TRUE)`,
        [adminId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM audit_log`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO audit_log (user_id, action, table_name, record_id, new_value, ip_address)
         VALUES ($1, 'CREATE', 'users', $1, '{"note": "Initial Supabase seed applied"}'::jsonb, '127.0.0.1')`,
        [adminId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM security_alerts`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO security_alerts (alert_type, severity, user_id, user_email, ip_address, message, status, resolved_at, resolved_by)
         VALUES ('SYSTEM_INIT_CHECK', 'LOW', $1, 'admin@hrhunter.com', '127.0.0.1', 'Monitoramento de segurança inicializado no Supabase.', 'RESOLVED', NOW(), $1)`,
        [adminId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM notifications`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read)
         VALUES ($1, 'SYSTEM_MESSAGE', 'Bem-vindo ao HR Hunter v2.0', 'Banco de dados Supabase configurado e populado com sucesso.', FALSE)`,
        [adminId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM unauthorized_access_log`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO unauthorized_access_log (user_id, user_email, resource, action, endpoint, ip_address)
         VALUES ($1, 'consultor@hrhunter.com', 'settings', 'read', '/api/v1/settings', '127.0.0.1')`,
        [recruiterId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM security_reports`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO security_reports (period_start, period_end, report_data, risk_score, risk_level, created_by)
         VALUES (NOW() - INTERVAL '7 days', NOW(), '{"totalAttempts": 1, "recommendations": ["Manter revisão periódica de permissões"]}'::jsonb, 5, 'LOW', $1)`,
        [adminId]
      );
    }

    if (Number((await client.query(`SELECT COUNT(*) FROM retention_execution_log`)).rows[0].count) === 0) {
      await client.query(
        `INSERT INTO retention_execution_log (executed_by, policy_summary, records_deleted)
         VALUES ($1, '{"auditLogDays": 90, "status": "baseline"}'::jsonb, 0)`,
        [adminId]
      );
    }

    await client.query('COMMIT');
    console.log('[OK] Initial Supabase seed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[FAIL] Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runSeed };
