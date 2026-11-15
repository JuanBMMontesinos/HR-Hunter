const { query, withTransaction } = require('../config/database');
const { mapRow, mapRows, normalizeOptionalString } = require('../utils/dbMapper');
const { renderTemplate, sanitizeHtml } = require('../utils/sanitizer');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const {
  parsePagination,
  buildPaginatedResult,
  SqlFilterBuilder,
  handlePgError,
} = require('../utils/queryHelpers');
const { logAction } = require('./auditService');
const { sendMail } = require('./emailService');

function formatProcessRow(row) {
  if (!row) return null;
  const mapped = mapRow(row);
  mapped.id = Number(mapped.id);
  mapped.jobOpeningId = Number(mapped.jobOpeningId);
  mapped.candidateId = Number(mapped.candidateId);
  mapped.currentStageId = Number(mapped.currentStageId);
  if (mapped.companyId !== undefined && mapped.companyId !== null) mapped.companyId = Number(mapped.companyId);
  if (mapped.funnelId !== undefined && mapped.funnelId !== null) mapped.funnelId = Number(mapped.funnelId);
  if (mapped.stageOrder !== undefined && mapped.stageOrder !== null) mapped.stageOrder = Number(mapped.stageOrder);
  if (mapped.daysInStage !== undefined && mapped.daysInStage !== null) mapped.daysInStage = Number(mapped.daysInStage);
  if (mapped.latestRating !== undefined && mapped.latestRating !== null) mapped.latestRating = Number(mapped.latestRating);
  return mapped;
}

async function listProcesses(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const fb = new SqlFilterBuilder();

  fb.addEq('rp.job_opening_id', filters.jobOpeningId ? Number(filters.jobOpeningId) : null);
  fb.addEq('rp.candidate_id', filters.candidateId ? Number(filters.candidateId) : null);
  fb.addEq('jo.company_id', filters.companyId ? Number(filters.companyId) : null);
  fb.addEq('rp.current_stage_id', filters.stageId ? Number(filters.stageId) : null);
  fb.addEq('rp.status', filters.status);
  fb.addIlikeAny(['c.full_name', 'c.email', 'jo.title', 'co.legal_name'], filters.search);

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT rp.*,
              jo.title AS job_title,
              jo.company_id,
              jo.funnel_id,
              co.legal_name AS company_name,
              c.full_name AS candidate_name,
              c.email AS candidate_email,
              rst.stage_name AS current_stage_name,
              rst.stage_order,
              rst.is_terminal AS current_stage_is_terminal,
              GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(ps.entered_at, rp.start_date))) / 86400))::INT AS days_in_stage,
              ps.rating AS latest_rating
       FROM recruitment_processes rp
       JOIN job_openings jo ON jo.id = rp.job_opening_id
       JOIN companies co ON co.id = jo.company_id
       JOIN candidates c ON c.id = rp.candidate_id
       JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
       LEFT JOIN LATERAL (
         SELECT entered_at, rating
         FROM process_stages
         WHERE process_id = rp.id
         ORDER BY entered_at DESC, id DESC
         LIMIT 1
       ) ps ON TRUE
       ${where}
       ORDER BY rp.updated_at DESC, rp.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(
      `SELECT COUNT(*)::INT AS total
       FROM recruitment_processes rp
       JOIN job_openings jo ON jo.id = rp.job_opening_id
       JOIN companies co ON co.id = jo.company_id
       JOIN candidates c ON c.id = rp.candidate_id
       ${where}`,
      fb.params.slice(0, fb.params.length - 2),
    ),
  ]);

  return buildPaginatedResult({
    items: rowsRes.rows.map(formatProcessRow),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

async function getKanbanBoard(filters = {}) {
  let effectiveFunnelId = filters.funnelId ? Number(filters.funnelId) : null;
  if (!effectiveFunnelId && filters.jobOpeningId) {
    const jobRes = await query(`SELECT funnel_id FROM job_openings WHERE id = $1`, [
      Number(filters.jobOpeningId),
    ]);
    effectiveFunnelId = jobRes.rows[0]?.funnel_id ? Number(jobRes.rows[0].funnel_id) : null;
  }

  let stagesRes;
  if (effectiveFunnelId) {
    stagesRes = await query(
      `SELECT rst.id, rst.stage_name, sfi.stage_order, rst.requires_feedback, rst.is_terminal
       FROM stage_funnel_items sfi
       JOIN recruitment_stage_template rst ON rst.id = sfi.stage_id
       WHERE sfi.funnel_id = $1 AND rst.is_active = TRUE
       ORDER BY sfi.stage_order ASC`,
      [effectiveFunnelId],
    );
  } else {
    stagesRes = await query(
      `SELECT id, stage_name, stage_order, requires_feedback, is_terminal
       FROM recruitment_stage_template
       WHERE is_active = TRUE
       ORDER BY stage_order ASC`,
    );
  }

  const fb = new SqlFilterBuilder();
  fb.addEq('rp.job_opening_id', filters.jobOpeningId ? Number(filters.jobOpeningId) : null);
  fb.addEq('jo.company_id', filters.companyId ? Number(filters.companyId) : null);
  fb.addEq('rp.status', filters.status);
  fb.addIlikeAny(['c.full_name', 'jo.title', 'co.legal_name'], filters.search);

  const procRes = await query(
    `SELECT rp.*,
            jo.title AS job_title,
            jo.company_id,
            co.legal_name AS company_name,
            c.full_name AS candidate_name,
            c.email AS candidate_email,
            rst.stage_name AS current_stage_name,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(ps.entered_at, rp.start_date))) / 86400))::INT AS days_in_stage,
            ps.rating AS latest_rating
     FROM recruitment_processes rp
     JOIN job_openings jo ON jo.id = rp.job_opening_id
     JOIN companies co ON co.id = jo.company_id
     JOIN candidates c ON c.id = rp.candidate_id
     JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
     LEFT JOIN LATERAL (
       SELECT entered_at, rating
       FROM process_stages
       WHERE process_id = rp.id
       ORDER BY entered_at DESC, id DESC
       LIMIT 1
     ) ps ON TRUE
     ${fb.whereClause()}
     ORDER BY rp.updated_at DESC, rp.id DESC`,
    fb.params,
  );

  const processesByStage = new Map();
  for (const row of procRes.rows) {
    const item = formatProcessRow(row);
    const list = processesByStage.get(item.currentStageId) || [];
    list.push(item);
    processesByStage.set(item.currentStageId, list);
  }

  const columns = mapRows(stagesRes.rows).map((st) => {
    const stageId = Number(st.id);
    const items = processesByStage.get(stageId) || [];
    return {
      stageId,
      stageName: st.stageName,
      stageOrder: Number(st.stageOrder),
      requiresFeedback: st.requiresFeedback,
      isTerminal: st.isTerminal,
      count: items.length,
      processes: items,
    };
  });

  return {
    funnelId: effectiveFunnelId,
    totalProcesses: procRes.rows.length,
    columns,
  };
}

async function getProcessById(id) {
  const procRes = await query(
    `SELECT rp.*,
            jo.title AS job_title,
            jo.department AS job_department,
            jo.company_id,
            jo.funnel_id,
            co.legal_name AS company_name,
            c.full_name AS candidate_name,
            c.email AS candidate_email,
            c.phone AS candidate_phone,
            rst.stage_name AS current_stage_name,
            rst.stage_order AS current_stage_order,
            rst.requires_feedback AS current_stage_requires_feedback,
            rst.is_terminal AS current_stage_is_terminal
     FROM recruitment_processes rp
     JOIN job_openings jo ON jo.id = rp.job_opening_id
     JOIN companies co ON co.id = jo.company_id
     JOIN candidates c ON c.id = rp.candidate_id
     JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
     WHERE rp.id = $1`,
    [id],
  );

  if (procRes.rows.length === 0) {
    throw new AppError('Processo seletivo não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const [stagesRes, offersRes] = await Promise.all([
    query(
      `SELECT ps.*,
              rst.stage_name,
              rst.is_terminal,
              u.full_name AS responsible_user_name
       FROM process_stages ps
       JOIN recruitment_stage_template rst ON rst.id = ps.stage_id
       LEFT JOIN users u ON u.id = ps.responsible_user_id
       WHERE ps.process_id = $1
       ORDER BY ps.entered_at ASC, ps.id ASC`,
      [id],
    ),
    query(`SELECT * FROM offers WHERE process_id = $1 ORDER BY sent_at DESC, id DESC`, [id]),
  ]);

  return {
    ...formatProcessRow(procRes.rows[0]),
    stages: mapRows(stagesRes.rows).map((s) => ({
      ...s,
      id: Number(s.id),
      processId: Number(s.processId),
      stageId: Number(s.stageId),
      responsibleUserId: s.responsibleUserId ? Number(s.responsibleUserId) : null,
    })),
    offers: mapRows(offersRes.rows).map((o) => ({
      ...o,
      id: Number(o.id),
      processId: Number(o.processId),
      salary: o.salary !== null ? Number(o.salary) : null,
    })),
  };
}

async function createProcess(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    const createdId = await withTransaction(async (client) => {
      const jobRes = await client.query(`SELECT id, funnel_id, status FROM job_openings WHERE id = $1`, [
        payload.jobOpeningId,
      ]);
      const candRes = await client.query(`SELECT id, status FROM candidates WHERE id = $1`, [payload.candidateId]);

      if (jobRes.rows.length === 0) {
        throw new AppError('Vaga não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      if (!['Aberta', 'Em Progresso'].includes(jobRes.rows[0].status)) {
        throw new AppError('Não é possível iniciar processo em vaga encerrada.', 409, ErrorCodes.RESOURCE_CONFLICT);
      }

      if (candRes.rows.length === 0) {
        throw new AppError('Candidato não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      if (candRes.rows[0].status !== 'Ativo') {
        throw new AppError('Candidato deve estar Ativo para ingressar em processo.', 409, ErrorCodes.RESOURCE_CONFLICT);
      }

      let initialStageId = payload.stageId || null;
      if (!initialStageId && jobRes.rows[0].funnel_id) {
        const firstFunnelStage = await client.query(
          `SELECT sfi.stage_id
           FROM stage_funnel_items sfi
           JOIN recruitment_stage_template rst ON rst.id = sfi.stage_id
           WHERE sfi.funnel_id = $1 AND rst.is_active = TRUE
           ORDER BY sfi.stage_order ASC
           LIMIT 1`,
          [jobRes.rows[0].funnel_id],
        );
        initialStageId = firstFunnelStage.rows[0]?.stage_id || null;
      }

      if (!initialStageId) {
        const defaultFirstStage = await client.query(
          `SELECT id FROM recruitment_stage_template WHERE is_active = TRUE ORDER BY stage_order ASC LIMIT 1`,
        );
        initialStageId = defaultFirstStage.rows[0]?.id || null;
      }

      if (!initialStageId) {
        throw new AppError('Nenhuma etapa inicial ativa configurada.', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const procRes = await client.query(
        `INSERT INTO recruitment_processes (job_opening_id, candidate_id, current_stage_id, status)
         VALUES ($1, $2, $3, 'Em Andamento')
         RETURNING *`,
        [payload.jobOpeningId, payload.candidateId, initialStageId],
      );
      const created = formatProcessRow(procRes.rows[0]);

      await client.query(
        `INSERT INTO process_stages (process_id, stage_id, feedback, responsible_user_id)
         VALUES ($1, $2, $3, $4)`,
        [
          created.id,
          initialStageId,
          normalizeOptionalString(payload.feedback) || 'Processo seletivo iniciado.',
          payload.responsibleUserId || actorUserId || null,
        ],
      );

      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'recruitment_processes',
        recordId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
        client,
      });

      return created.id;
    });

    return getProcessById(createdId);
  } catch (err) {
    handlePgError(err, {
      uq_active_process_job_candidate: {
        message: 'Candidato já possui um processo ativo para esta vaga.',
        statusCode: 409,
        errorCode: ErrorCodes.RESOURCE_CONFLICT,
      },
    });
  }
}

async function updateProcess(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM recruitment_processes WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Processo seletivo não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const oldProc = formatProcessRow(existingRes.rows[0]);

    const sets = [];
    const values = [];
    if (payload.status !== undefined) {
      values.push(payload.status);
      sets.push(`status = $${values.length}`);
      if (payload.status === 'Concluído' && payload.endDate === undefined && !oldProc.endDate) {
        values.push(new Date().toISOString());
        sets.push(`end_date = $${values.length}`);
      }
    }
    if (payload.currentStageId !== undefined) {
      const stageCheck = await client.query(`SELECT id FROM recruitment_stage_template WHERE id = $1`, [
        payload.currentStageId,
      ]);
      if (stageCheck.rows.length === 0) {
        throw new AppError('Etapa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      values.push(payload.currentStageId);
      sets.push(`current_stage_id = $${values.length}`);
    }
    if (payload.endDate !== undefined) {
      values.push(payload.endDate);
      sets.push(`end_date = $${values.length}`);
    }

    if (sets.length === 0) return oldProc;
    values.push(id);
    const updatedRes = await client.query(
      `UPDATE recruitment_processes SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    const updated = formatProcessRow(updatedRes.rows[0]);

    await logAction({
      userId: actorUserId,
      action: 'UPDATE',
      tableName: 'recruitment_processes',
      recordId: id,
      oldValue: oldProc,
      newValue: updated,
      ipAddress,
      userAgent,
      client,
    });

    return updated;
  });
}

async function resolveNextStageId(client, processRow, explicitNextStageId) {
  if (explicitNextStageId) {
    const target = await client.query(
      `SELECT id FROM recruitment_stage_template WHERE id = $1 AND is_active = TRUE`,
      [explicitNextStageId],
    );
    if (target.rows.length === 0) {
      throw new AppError('Etapa de destino não encontrada ou inativa.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    return Number(target.rows[0].id);
  }

  let orderedStagesRes;
  if (processRow.funnel_id) {
    orderedStagesRes = await client.query(
      `SELECT rst.id, rst.stage_name
       FROM stage_funnel_items sfi
       JOIN recruitment_stage_template rst ON rst.id = sfi.stage_id
       WHERE sfi.funnel_id = $1 AND rst.is_active = TRUE AND rst.stage_name <> 'Rejeitado'
       ORDER BY sfi.stage_order ASC`,
      [processRow.funnel_id],
    );
  } else {
    orderedStagesRes = await client.query(
      `SELECT id, stage_name
       FROM recruitment_stage_template
       WHERE is_active = TRUE AND stage_name <> 'Rejeitado'
       ORDER BY stage_order ASC`,
    );
  }

  const list = orderedStagesRes.rows.map((r) => Number(r.id));
  const currentIdx = list.indexOf(Number(processRow.current_stage_id));
  if (currentIdx === -1 || currentIdx >= list.length - 1) {
    throw new AppError(
      'Processo já está na etapa final ou sem próxima etapa automática definida.',
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  return list[currentIdx + 1];
}

async function advanceToNextStage(
  processId,
  payload,
  { actorUserId } = {},
) {
  return withTransaction(async (client) => {
    const procRes = await client.query(
      `SELECT rp.*, jo.funnel_id, rst.requires_feedback AS current_requires_feedback
       FROM recruitment_processes rp
       JOIN job_openings jo ON jo.id = rp.job_opening_id
       JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
       WHERE rp.id = $1
       FOR UPDATE OF rp`,
      [processId],
    );

    if (procRes.rows.length === 0) {
      throw new AppError('Processo seletivo não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const proc = procRes.rows[0];
    if (proc.status === 'Concluído') {
      throw new AppError('Processo já concluído não pode avançar de etapa.', 409, ErrorCodes.RESOURCE_CONFLICT);
    }

    const nextStageId = await resolveNextStageId(client, proc, payload.nextStageId);
    const docsJson = JSON.stringify(payload.attachedDocuments || []);

    const moveRes = await client.query(
      `SELECT * FROM fn_move_to_next_stage($1::bigint, $2::bigint, $3::text, $4::int, $5::bigint, $6::jsonb)`,
      [
        processId,
        nextStageId,
        normalizeOptionalString(payload.feedback),
        payload.rating ?? null,
        actorUserId || null,
        docsJson,
      ],
    );

    const processStageId = Number(moveRes.rows[0].process_stage_id);
    if (payload.strengths || payload.weaknesses || payload.recommendation || payload.scheduledAt) {
      await client.query(
        `UPDATE process_stages
         SET strengths = COALESCE($2, strengths),
             weaknesses = COALESCE($3, weaknesses),
             recommendation = COALESCE($4, recommendation),
             scheduled_at = COALESCE($5, scheduled_at)
         WHERE id = $1`,
        [
          processStageId,
          normalizeOptionalString(payload.strengths),
          normalizeOptionalString(payload.weaknesses),
          normalizeOptionalString(payload.recommendation),
          normalizeOptionalString(payload.scheduledAt),
        ],
      );
    }

    return processStageId;
  }).then(() => getProcessById(processId));
}

async function dispatchProcessTemplateEmail(templateKey, context) {
  const tplRes = await query(
    `SELECT subject, body_html FROM email_templates WHERE template_key = $1 AND is_active = TRUE LIMIT 1`,
    [templateKey],
  );
  if (tplRes.rows.length === 0) {
    return { sent: false, reason: `Template '${templateKey}' não encontrado.` };
  }

  const tpl = tplRes.rows[0];
  const subject = renderTemplate(tpl.subject, context);
  const html = renderTemplate(tpl.body_html, context);
  const mailResult = await sendMail({
    to: context.candidateEmail,
    subject,
    html,
  });
  return { sent: true, ...mailResult };
}

async function rejectProcess(processId, payload, { actorUserId } = {}) {
  let emailContext = null;

  await withTransaction(async (client) => {
    const procRes = await client.query(
      `SELECT rp.*, c.full_name AS candidate_name, c.email AS candidate_email,
              jo.title AS job_title, co.legal_name AS company_name
       FROM recruitment_processes rp
       JOIN candidates c ON c.id = rp.candidate_id
       JOIN job_openings jo ON jo.id = rp.job_opening_id
       JOIN companies co ON co.id = jo.company_id
       WHERE rp.id = $1
       FOR UPDATE OF rp`,
      [processId],
    );

    if (procRes.rows.length === 0) {
      throw new AppError('Processo seletivo não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const proc = procRes.rows[0];
    if (proc.status === 'Concluído') {
      throw new AppError('Processo já está concluído.', 409, ErrorCodes.RESOURCE_CONFLICT);
    }

    const rejectedStageRes = await client.query(
      `SELECT id FROM recruitment_stage_template WHERE stage_name = 'Rejeitado' LIMIT 1`,
    );
    if (rejectedStageRes.rows.length === 0) {
      throw new AppError("Etapa 'Rejeitado' não configurada.", 500, ErrorCodes.INTERNAL_ERROR);
    }

    const moveRes = await client.query(
      `SELECT * FROM fn_move_to_next_stage($1::bigint, $2::bigint, $3::text, $4::int, $5::bigint, '[]'::jsonb)`,
      [
        processId,
        Number(rejectedStageRes.rows[0].id),
        payload.reason,
        payload.rating ?? null,
        actorUserId || null,
      ],
    );

    await client.query(`UPDATE process_stages SET recommendation = 'Rejeitar' WHERE id = $1`, [
      Number(moveRes.rows[0].process_stage_id),
    ]);

    emailContext = {
      candidateName: proc.candidate_name,
      candidateEmail: proc.candidate_email,
      jobTitle: proc.job_title,
      companyName: proc.company_name,
    };
  });

  const emailResult = payload.sendEmail
    ? await dispatchProcessTemplateEmail('candidate_rejection', emailContext)
    : { sent: false, skipped: true };

  const processDetails = await getProcessById(processId);
  return { process: processDetails, emailResult };
}

async function createOfferForProcess(
  processId,
  payload,
  { actorUserId, ipAddress = null, userAgent = null } = {},
) {
  let emailContext = null;

  const createdOfferId = await withTransaction(async (client) => {
    const procRes = await client.query(
      `SELECT rp.*, c.full_name AS candidate_name, c.email AS candidate_email,
              jo.title AS job_title, co.legal_name AS company_name
       FROM recruitment_processes rp
       JOIN candidates c ON c.id = rp.candidate_id
       JOIN job_openings jo ON jo.id = rp.job_opening_id
       JOIN companies co ON co.id = jo.company_id
       WHERE rp.id = $1
       FOR UPDATE OF rp`,
      [processId],
    );

    if (procRes.rows.length === 0) {
      throw new AppError('Processo seletivo não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const proc = procRes.rows[0];
    if (proc.status === 'Concluído') {
      throw new AppError('Não é possível enviar proposta em processo concluído.', 409, ErrorCodes.RESOURCE_CONFLICT);
    }

    const offerStageRes = await client.query(
      `SELECT id FROM recruitment_stage_template WHERE stage_name = 'Oferta' LIMIT 1`,
    );
    if (offerStageRes.rows.length === 0) {
      throw new AppError("Etapa 'Oferta' não configurada.", 500, ErrorCodes.INTERNAL_ERROR);
    }
    const offerStageId = Number(offerStageRes.rows[0].id);

    const position = normalizeOptionalString(payload.position) || proc.job_title;
    const offerRes = await client.query(
      `INSERT INTO offers (process_id, position, salary, benefits, start_date, conditions, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Enviada')
       RETURNING *`,
      [
        processId,
        position,
        payload.salary ?? null,
        normalizeOptionalString(payload.benefits),
        normalizeOptionalString(payload.startDate),
        normalizeOptionalString(payload.conditions),
      ],
    );
    const offer = mapRow(offerRes.rows[0]);
    offer.id = Number(offer.id);

    if (Number(proc.current_stage_id) !== offerStageId) {
      await client.query(
        `SELECT * FROM fn_move_to_next_stage($1::bigint, $2::bigint, $3::text, NULL, $4::bigint, '[]'::jsonb)`,
        [processId, offerStageId, `Proposta enviada para ${position}.`, actorUserId || null],
      );
    }

    await logAction({
      userId: actorUserId,
      action: 'CREATE',
      tableName: 'offers',
      recordId: offer.id,
      newValue: offer,
      ipAddress,
      userAgent,
      client,
    });

    emailContext = {
      candidateName: proc.candidate_name,
      candidateEmail: proc.candidate_email,
      jobTitle: proc.job_title,
      companyName: proc.company_name,
      salary: payload.salary !== undefined && payload.salary !== null ? String(payload.salary) : 'A combinar',
      startDate: normalizeOptionalString(payload.startDate) || 'A definir',
    };

    return offer.id;
  });

  const emailResult = payload.sendEmail
    ? await dispatchProcessTemplateEmail('job_offer', emailContext)
    : { sent: false, skipped: true };

  const processDetails = await getProcessById(processId);
  const offer = processDetails.offers.find((o) => o.id === createdOfferId) || processDetails.offers[0];
  return { process: processDetails, offer, emailResult };
}

async function updateOfferStatus(
  processId,
  offerId,
  payload,
  { actorUserId, ipAddress = null, userAgent = null } = {},
) {
  await withTransaction(async (client) => {
    const offerRes = await client.query(
      `SELECT * FROM offers WHERE id = $1 AND process_id = $2 FOR UPDATE`,
      [offerId, processId],
    );
    if (offerRes.rows.length === 0) {
      throw new AppError('Proposta não encontrada para este processo.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const oldOffer = mapRow(offerRes.rows[0]);

    const updatedRes = await client.query(
      `UPDATE offers
       SET status = $1::varchar,
           viewed_at = CASE WHEN $1::text = 'Visualizada' AND viewed_at IS NULL THEN NOW() ELSE viewed_at END,
           response_at = CASE WHEN $1::text IN ('Aceita', 'Recusada') THEN NOW() ELSE response_at END
       WHERE id = $2
       RETURNING *`,
      [payload.status, offerId],
    );

    if (payload.status === 'Aceita' && payload.advanceToHired !== false) {
      const hiredRes = await client.query(
        `SELECT id FROM recruitment_stage_template WHERE stage_name = 'Contratado' LIMIT 1`,
      );
      if (hiredRes.rows.length > 0) {
        await client.query(
          `SELECT * FROM fn_move_to_next_stage($1::bigint, $2::bigint, 'Proposta aceita pelo candidato.', NULL, $3::bigint, '[]'::jsonb)`,
          [processId, Number(hiredRes.rows[0].id), actorUserId || null],
        );
      }
    }

    await logAction({
      userId: actorUserId,
      action: 'UPDATE',
      tableName: 'offers',
      recordId: offerId,
      oldValue: oldOffer,
      newValue: mapRow(updatedRes.rows[0]),
      ipAddress,
      userAgent,
      client,
    });
  });

  return getProcessById(processId);
}

async function getProcessTimeline(processId) {
  const proc = await getProcessById(processId);

  const auditRes = await query(
    `SELECT al.id, al.action, al.table_name, al.old_value, al.new_value, al.created_at,
            u.full_name AS user_name
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE (al.table_name = 'recruitment_processes' AND al.record_id = $1)
        OR (al.table_name = 'offers' AND al.record_id = ANY($2::bigint[]))
     ORDER BY al.created_at ASC, al.id ASC`,
    [processId, proc.offers.map((o) => o.id)],
  );

  const events = [
    ...proc.stages.map((st) => ({
      eventType: 'STAGE_CHANGE',
      timestamp: st.enteredAt,
      title: st.stageName,
      description: st.feedback,
      rating: st.rating,
      recommendation: st.recommendation,
      actorName: st.responsibleUserName,
      meta: {
        stageId: st.stageId,
        exitedAt: st.exitedAt,
        strengths: st.strengths,
        weaknesses: st.weaknesses,
        attachedDocuments: st.attachedDocuments,
      },
    })),
    ...proc.offers.map((o) => ({
      eventType: 'OFFER',
      timestamp: o.sentAt,
      title: `Proposta: ${o.position} (${o.status})`,
      description: o.conditions,
      meta: o,
    })),
    ...mapRows(auditRes.rows).map((a) => ({
      eventType: 'AUDIT',
      timestamp: a.createdAt,
      title: `${a.action} em ${a.tableName}`,
      actorName: a.userName,
      meta: { id: Number(a.id), oldValue: a.oldValue, newValue: a.newValue },
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    process: proc,
    timeline: events,
  };
}

module.exports = {
  listProcesses,
  getKanbanBoard,
  getProcessById,
  createProcess,
  updateProcess,
  advanceToNextStage,
  rejectProcess,
  createOfferForProcess,
  updateOfferStatus,
  getProcessTimeline,
};
