const { query, withTransaction } = require('../config/database');
const { mapRow, mapRows, normalizeOptionalString } = require('../utils/dbMapper');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const {
  parsePagination,
  buildPaginatedResult,
  SqlFilterBuilder,
  handlePgError,
  buildDynamicUpdate,
} = require('../utils/queryHelpers');
const { logAction } = require('./auditService');

const JOB_UPDATE_MAP = {
  companyId: 'company_id',
  funnelId: 'funnel_id',
  title: 'title',
  description: { column: 'description', transform: normalizeOptionalString },
  department: { column: 'department', transform: normalizeOptionalString },
  level: { column: 'level', transform: normalizeOptionalString },
  contractType: { column: 'contract_type', transform: normalizeOptionalString },
  regime: { column: 'regime', transform: normalizeOptionalString },
  minSalary: 'min_salary',
  maxSalary: 'max_salary',
  quantityNeeded: 'quantity_needed',
  requiredSkills: { column: 'required_skills', transform: normalizeOptionalString },
  desiredSkills: { column: 'desired_skills', transform: normalizeOptionalString },
  benefits: { column: 'benefits', transform: normalizeOptionalString },
  openedAt: { column: 'opened_at', transform: normalizeOptionalString },
  plannedClosedAt: { column: 'planned_closed_at', transform: normalizeOptionalString },
  closedAt: { column: 'closed_at', transform: normalizeOptionalString },
  closedReason: { column: 'closed_reason', transform: normalizeOptionalString },
  responsibleUserId: 'responsible_user_id',
  status: 'status',
  priority: 'priority',
};

function formatJobOpeningRow(row) {
  if (!row) return null;
  const mapped = mapRow(row);
  mapped.id = Number(mapped.id);
  mapped.companyId = Number(mapped.companyId);
  if (mapped.funnelId !== null && mapped.funnelId !== undefined) mapped.funnelId = Number(mapped.funnelId);
  if (mapped.responsibleUserId !== null && mapped.responsibleUserId !== undefined) {
    mapped.responsibleUserId = Number(mapped.responsibleUserId);
  }
  if (mapped.minSalary !== null && mapped.minSalary !== undefined) mapped.minSalary = Number(mapped.minSalary);
  if (mapped.maxSalary !== null && mapped.maxSalary !== undefined) mapped.maxSalary = Number(mapped.maxSalary);
  if (mapped.quantityNeeded !== undefined) mapped.quantityNeeded = Number(mapped.quantityNeeded);
  if (mapped.daysOpen !== undefined) mapped.daysOpen = Number(mapped.daysOpen);
  if (mapped.totalCandidates !== undefined) mapped.totalCandidates = Number(mapped.totalCandidates);
  if (mapped.activeCandidates !== undefined) mapped.activeCandidates = Number(mapped.activeCandidates);
  if (mapped.hiredCandidates !== undefined) mapped.hiredCandidates = Number(mapped.hiredCandidates);
  return mapped;
}

async function listJobOpenings(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const fb = new SqlFilterBuilder();

  fb.addEq('jo.company_id', filters.companyId ? Number(filters.companyId) : null);
  fb.addEq('jo.status', filters.status);
  fb.addEq('jo.level', filters.level);
  fb.addEq('jo.contract_type', filters.contractType);
  fb.addEq('jo.regime', filters.regime);
  fb.addEq('jo.priority', filters.priority);
  fb.addEq('jo.responsible_user_id', filters.responsibleUserId ? Number(filters.responsibleUserId) : null);
  fb.addIlikeAny(['jo.department'], filters.department);
  fb.addIlikeAny(['jo.title', 'jo.description', 'jo.required_skills'], filters.search);

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT jo.*,
              co.legal_name AS company_name,
              sf.name AS funnel_name,
              u.full_name AS responsible_user_name,
              COALESCE(vw.days_open, 0)::INT AS days_open,
              COALESCE(vw.total_candidates, 0)::INT AS total_candidates,
              COALESCE(vw.active_candidates, 0)::INT AS active_candidates,
              COALESCE(vw.hired_candidates, 0)::INT AS hired_candidates
       FROM job_openings jo
       INNER JOIN companies co ON co.id = jo.company_id
       LEFT JOIN stage_funnels sf ON sf.id = jo.funnel_id
       LEFT JOIN users u ON u.id = jo.responsible_user_id
       LEFT JOIN vw_job_opening_summary vw ON vw.id = jo.id
       ${where}
       ORDER BY jo.opened_at DESC, jo.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(`SELECT COUNT(*)::INT AS total FROM job_openings jo ${where}`, fb.params.slice(0, fb.params.length - 2)),
  ]);

  return buildPaginatedResult({
    items: rowsRes.rows.map(formatJobOpeningRow),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

async function getJobOpeningById(id) {
  const res = await query(
    `SELECT jo.*,
            co.legal_name AS company_name,
            sf.name AS funnel_name,
            u.full_name AS responsible_user_name,
            COALESCE(vw.days_open, 0)::INT AS days_open,
            COALESCE(vw.total_candidates, 0)::INT AS total_candidates,
            COALESCE(vw.active_candidates, 0)::INT AS active_candidates,
            COALESCE(vw.hired_candidates, 0)::INT AS hired_candidates
     FROM job_openings jo
     INNER JOIN companies co ON co.id = jo.company_id
     LEFT JOIN stage_funnels sf ON sf.id = jo.funnel_id
     LEFT JOIN users u ON u.id = jo.responsible_user_id
     LEFT JOIN vw_job_opening_summary vw ON vw.id = jo.id
     WHERE jo.id = $1`,
    [id],
  );

  if (res.rows.length === 0) {
    throw new AppError('Vaga não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const job = formatJobOpeningRow(res.rows[0]);
  if (job.funnelId) {
    const stagesRes = await query(
      `SELECT rst.id, rst.stage_name, sfi.stage_order, rst.requires_feedback, rst.is_terminal
       FROM stage_funnel_items sfi
       JOIN recruitment_stage_template rst ON rst.id = sfi.stage_id
       WHERE sfi.funnel_id = $1
       ORDER BY sfi.stage_order ASC`,
      [job.funnelId],
    );
    job.funnelStages = mapRows(stagesRes.rows).map((s) => ({ ...s, id: Number(s.id) }));
  } else {
    job.funnelStages = [];
  }

  return job;
}

async function getJobOpeningCandidates(id) {
  const check = await query(`SELECT id FROM job_openings WHERE id = $1`, [id]);
  if (check.rows.length === 0) {
    throw new AppError('Vaga não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const res = await query(
    `SELECT rp.id AS process_id,
            rp.status AS process_status,
            rp.start_date,
            rp.end_date,
            c.id AS candidate_id,
            c.full_name,
            c.email,
            c.phone,
            c.status AS candidate_status,
            rst.id AS current_stage_id,
            rst.stage_name AS current_stage_name,
            ps.rating AS latest_rating,
            ps.entered_at AS stage_entered_at
     FROM recruitment_processes rp
     JOIN candidates c ON c.id = rp.candidate_id
     JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
     LEFT JOIN LATERAL (
       SELECT rating, entered_at
       FROM process_stages
       WHERE process_id = rp.id
       ORDER BY entered_at DESC, id DESC
       LIMIT 1
     ) ps ON TRUE
     WHERE rp.job_opening_id = $1
     ORDER BY rp.start_date DESC`,
    [id],
  );

  return mapRows(res.rows).map((row) => ({
    ...row,
    processId: Number(row.processId),
    candidateId: Number(row.candidateId),
    currentStageId: Number(row.currentStageId),
    latestRating: row.latestRating !== null ? Number(row.latestRating) : null,
  }));
}

async function getJobOpeningAnalytics(id) {
  const job = await getJobOpeningById(id);

  const [byStageRes, statusBreakdownRes, offersRes] = await Promise.all([
    query(`SELECT * FROM fn_get_candidates_by_stage($1::bigint, NULL)`, [id]),
    query(
      `SELECT status, COUNT(*)::INT AS count
       FROM recruitment_processes
       WHERE job_opening_id = $1
       GROUP BY status`,
      [id],
    ),
    query(
      `SELECT o.status, COUNT(*)::INT AS count
       FROM offers o
       JOIN recruitment_processes rp ON rp.id = o.process_id
       WHERE rp.job_opening_id = $1
       GROUP BY o.status`,
      [id],
    ),
  ]);

  return {
    jobOpening: {
      id: job.id,
      title: job.title,
      status: job.status,
      daysOpen: job.daysOpen,
      totalCandidates: job.totalCandidates,
      activeCandidates: job.activeCandidates,
      hiredCandidates: job.hiredCandidates,
    },
    candidatesByStage: mapRows(byStageRes.rows).map((row) => ({
      ...row,
      stageId: Number(row.stageId),
      candidateCount: Number(row.candidateCount || 0),
      averageRating: row.averageRating !== null ? Number(row.averageRating) : null,
    })),
    processStatusBreakdown: mapRows(statusBreakdownRes.rows),
    offersBreakdown: mapRows(offersRes.rows),
  };
}

async function validateJobReferences(client, { companyId, funnelId, responsibleUserId }) {
  if (companyId !== undefined) {
    const comp = await client.query(`SELECT id, status FROM companies WHERE id = $1`, [companyId]);
    if (comp.rows.length === 0) {
      throw new AppError('Empresa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
  }

  if (funnelId !== undefined && funnelId !== null) {
    const funnel = await client.query(`SELECT id FROM stage_funnels WHERE id = $1`, [funnelId]);
    if (funnel.rows.length === 0) {
      throw new AppError('Funil de etapas não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
  }

  if (responsibleUserId !== undefined && responsibleUserId !== null) {
    const user = await client.query(`SELECT id FROM users WHERE id = $1`, [responsibleUserId]);
    if (user.rows.length === 0) {
      throw new AppError('Usuário responsável não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
  }
}

async function createJobOpening(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      let resolvedFunnelId = payload.funnelId ?? null;
      if (!resolvedFunnelId) {
        const def = await client.query(
          `SELECT id FROM stage_funnels WHERE is_default = TRUE AND is_active = TRUE LIMIT 1`,
        );
        resolvedFunnelId = def.rows[0]?.id ? Number(def.rows[0].id) : null;
      }

      const resolvedResponsibleId = payload.responsibleUserId ?? actorUserId ?? null;
      await validateJobReferences(client, {
        companyId: payload.companyId,
        funnelId: resolvedFunnelId,
        responsibleUserId: resolvedResponsibleId,
      });

      const openedAt = normalizeOptionalString(payload.openedAt) || new Date().toISOString();

      const res = await client.query(
        `INSERT INTO job_openings (
           company_id, funnel_id, title, description, department, level, contract_type, regime,
           min_salary, max_salary, quantity_needed, required_skills, desired_skills, benefits,
           opened_at, planned_closed_at, closed_at, closed_reason, responsible_user_id, status, priority
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [
          payload.companyId,
          resolvedFunnelId,
          payload.title,
          normalizeOptionalString(payload.description),
          normalizeOptionalString(payload.department),
          normalizeOptionalString(payload.level),
          normalizeOptionalString(payload.contractType),
          normalizeOptionalString(payload.regime),
          payload.minSalary ?? null,
          payload.maxSalary ?? null,
          payload.quantityNeeded || 1,
          normalizeOptionalString(payload.requiredSkills),
          normalizeOptionalString(payload.desiredSkills),
          normalizeOptionalString(payload.benefits),
          openedAt,
          normalizeOptionalString(payload.plannedClosedAt),
          normalizeOptionalString(payload.closedAt),
          normalizeOptionalString(payload.closedReason),
          resolvedResponsibleId,
          payload.status || 'Aberta',
          payload.priority || 'Média',
        ],
      );

      const created = formatJobOpeningRow(res.rows[0]);
      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'job_openings',
        recordId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
        client,
      });

      return created;
    });
  } catch (err) {
    handlePgError(err);
  }
}

async function updateJobOpening(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(`SELECT * FROM job_openings WHERE id = $1 FOR UPDATE`, [id]);
      if (existingRes.rows.length === 0) {
        throw new AppError('Vaga não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const oldJob = formatJobOpeningRow(existingRes.rows[0]);
      if (oldJob.status === 'Preenchida') {
        throw new AppError(
          'Vaga com status Preenchida não pode ser editada.',
          409,
          ErrorCodes.RESOURCE_CONFLICT,
        );
      }

      const effectiveMin = payload.minSalary !== undefined ? payload.minSalary : oldJob.minSalary;
      const effectiveMax = payload.maxSalary !== undefined ? payload.maxSalary : oldJob.maxSalary;
      if (effectiveMin !== null && effectiveMax !== null && Number(effectiveMax) < Number(effectiveMin)) {
        throw new AppError('maxSalary deve ser maior ou igual a minSalary.', 400, ErrorCodes.VALIDATION_ERROR);
      }

      await validateJobReferences(client, {
        companyId: payload.companyId,
        funnelId: payload.funnelId,
        responsibleUserId: payload.responsibleUserId,
      });

      const nextPayload = { ...payload };
      if ((nextPayload.status === 'Preenchida' || nextPayload.status === 'Cancelada') && !nextPayload.closedAt) {
        nextPayload.closedAt = new Date().toISOString();
      }

      const { sets, values } = buildDynamicUpdate(nextPayload, JOB_UPDATE_MAP);
      if (sets.length === 0) return oldJob;

      values.push(id);
      const updatedRes = await client.query(
        `UPDATE job_openings SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      const updated = formatJobOpeningRow(updatedRes.rows[0]);

      await logAction({
        userId: actorUserId,
        action: 'UPDATE',
        tableName: 'job_openings',
        recordId: id,
        oldValue: oldJob,
        newValue: updated,
        ipAddress,
        userAgent,
        client,
      });

      return updated;
    });
  } catch (err) {
    handlePgError(err);
  }
}

async function deleteJobOpening(id, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM job_openings WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Vaga não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const activeRes = await client.query(
      `SELECT COUNT(*)::INT AS cnt
       FROM recruitment_processes
       WHERE job_opening_id = $1 AND status IN ('Em Andamento', 'Parado')`,
      [id],
    );
    if (activeRes.rows[0].cnt > 0) {
      throw new AppError(
        'Não é possível excluir vaga com processos seletivos ativos.',
        409,
        ErrorCodes.RESOURCE_CONFLICT,
      );
    }

    const histRes = await client.query(
      `SELECT COUNT(*)::INT AS cnt FROM recruitment_processes WHERE job_opening_id = $1`,
      [id],
    );

    const oldJob = formatJobOpeningRow(existingRes.rows[0]);

    if (histRes.rows[0].cnt > 0) {
      const cancelledRes = await client.query(
        `UPDATE job_openings
         SET status = 'Cancelada', closed_at = COALESCE(closed_at, NOW())
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      const updated = formatJobOpeningRow(cancelledRes.rows[0]);
      await logAction({
        userId: actorUserId,
        action: 'DELETE',
        tableName: 'job_openings',
        recordId: id,
        oldValue: oldJob,
        newValue: { status: 'Cancelada', softCancelled: true },
        ipAddress,
        userAgent,
        client,
      });
      return { deleted: false, softCancelled: true, jobOpening: updated };
    }

    await client.query(`DELETE FROM job_openings WHERE id = $1`, [id]);
    await logAction({
      userId: actorUserId,
      action: 'DELETE',
      tableName: 'job_openings',
      recordId: id,
      oldValue: oldJob,
      ipAddress,
      userAgent,
      client,
    });

    return { deleted: true, softCancelled: false, id: Number(id) };
  });
}

module.exports = {
  listJobOpenings,
  getJobOpeningById,
  getJobOpeningCandidates,
  getJobOpeningAnalytics,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening,
};
