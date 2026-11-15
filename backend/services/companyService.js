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

const COMPANY_UPDATE_MAP = {
  legalName: 'legal_name',
  tradeName: { column: 'trade_name', transform: normalizeOptionalString },
  cnpj: 'cnpj',
  sector: { column: 'sector', transform: normalizeOptionalString },
  street: { column: 'street', transform: normalizeOptionalString },
  number: { column: 'number', transform: normalizeOptionalString },
  complement: { column: 'complement', transform: normalizeOptionalString },
  city: { column: 'city', transform: normalizeOptionalString },
  state: { column: 'state', transform: normalizeOptionalString },
  country: { column: 'country', transform: (v) => normalizeOptionalString(v) || 'Brasil' },
  postalCode: { column: 'postal_code', transform: normalizeOptionalString },
  phone: { column: 'phone', transform: normalizeOptionalString },
  email: { column: 'email', transform: normalizeOptionalString },
  website: { column: 'website', transform: normalizeOptionalString },
  contactName: { column: 'contact_name', transform: normalizeOptionalString },
  contactEmail: { column: 'contact_email', transform: normalizeOptionalString },
  contactPhone: { column: 'contact_phone', transform: normalizeOptionalString },
  notes: { column: 'notes', transform: normalizeOptionalString },
  status: 'status',
};

function formatCompanyRow(row) {
  if (!row) return null;
  const mapped = mapRow(row);
  mapped.id = Number(mapped.id);
  if (mapped.totalJobOpenings !== undefined) mapped.totalJobOpenings = Number(mapped.totalJobOpenings);
  if (mapped.activeJobOpenings !== undefined) mapped.activeJobOpenings = Number(mapped.activeJobOpenings);
  return mapped;
}

async function listCompanies(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 20 });
  const fb = new SqlFilterBuilder();

  fb.addIlikeAny(['c.legal_name', 'c.trade_name', 'c.cnpj'], filters.name || filters.search);
  fb.addEq('c.status', filters.status);
  fb.addIlikeAny(['c.sector'], filters.sector);
  fb.addIlikeAny(['c.cnpj'], filters.cnpj);

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT c.*,
              COUNT(jo.id)::INT AS total_job_openings,
              COUNT(jo.id) FILTER (WHERE jo.status IN ('Aberta', 'Em Progresso'))::INT AS active_job_openings
       FROM companies c
       LEFT JOIN job_openings jo ON jo.company_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.legal_name ASC, c.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(`SELECT COUNT(*)::INT AS total FROM companies c ${where}`, fb.params.slice(0, fb.params.length - 2)),
  ]);

  return buildPaginatedResult({
    items: rowsRes.rows.map(formatCompanyRow),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

async function getCompanyById(id) {
  const [companyRes, metricsRes, jobsRes] = await Promise.all([
    query(`SELECT * FROM companies WHERE id = $1`, [id]),
    query(
      `SELECT
         COUNT(DISTINCT jo.id)::INT AS total_job_openings,
         COUNT(DISTINCT jo.id) FILTER (WHERE jo.status IN ('Aberta', 'Em Progresso'))::INT AS active_job_openings,
         COUNT(DISTINCT jo.id) FILTER (WHERE jo.status = 'Preenchida')::INT AS filled_job_openings,
         COUNT(DISTINCT rp.candidate_id)::INT AS total_candidates_applied,
         COUNT(DISTINCT rp.candidate_id) FILTER (WHERE rp.status = 'Em Andamento')::INT AS candidates_in_process
       FROM job_openings jo
       LEFT JOIN recruitment_processes rp ON rp.job_opening_id = jo.id
       WHERE jo.company_id = $1`,
      [id],
    ),
    query(
      `SELECT id, title, department, level, status, priority, opened_at
       FROM job_openings
       WHERE company_id = $1
       ORDER BY opened_at DESC
       LIMIT 10`,
      [id],
    ),
  ]);

  if (companyRes.rows.length === 0) {
    throw new AppError('Empresa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const company = formatCompanyRow(companyRes.rows[0]);
  const stats = mapRow(metricsRes.rows[0]);
  company.stats = {
    totalJobOpenings: Number(stats.totalJobOpenings || 0),
    activeJobOpenings: Number(stats.activeJobOpenings || 0),
    filledJobOpenings: Number(stats.filledJobOpenings || 0),
    totalCandidatesApplied: Number(stats.totalCandidatesApplied || 0),
    candidatesInProcess: Number(stats.candidatesInProcess || 0),
  };
  company.recentJobOpenings = mapRows(jobsRes.rows).map((j) => ({ ...j, id: Number(j.id) }));
  return company;
}

async function createCompany(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const existing = await client.query(`SELECT id FROM companies WHERE cnpj = $1 LIMIT 1`, [
        payload.cnpj.trim(),
      ]);
      if (existing.rows.length > 0) {
        throw new AppError('CNPJ já cadastrado no sistema.', 409, ErrorCodes.DUPLICATE_DOCUMENT);
      }

      const res = await client.query(
        `INSERT INTO companies (
           legal_name, trade_name, cnpj, sector, street, number, complement,
           city, state, country, postal_code, phone, email, website,
           contact_name, contact_email, contact_phone, notes, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
          payload.legalName,
          normalizeOptionalString(payload.tradeName),
          payload.cnpj.trim(),
          normalizeOptionalString(payload.sector),
          normalizeOptionalString(payload.street),
          normalizeOptionalString(payload.number),
          normalizeOptionalString(payload.complement),
          normalizeOptionalString(payload.city),
          normalizeOptionalString(payload.state),
          normalizeOptionalString(payload.country) || 'Brasil',
          normalizeOptionalString(payload.postalCode),
          normalizeOptionalString(payload.phone),
          normalizeOptionalString(payload.email),
          normalizeOptionalString(payload.website),
          normalizeOptionalString(payload.contactName),
          normalizeOptionalString(payload.contactEmail),
          normalizeOptionalString(payload.contactPhone),
          normalizeOptionalString(payload.notes),
          payload.status || 'Ativo',
        ],
      );

      const created = formatCompanyRow(res.rows[0]);
      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'companies',
        recordId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
        client,
      });
      return created;
    });
  } catch (err) {
    handlePgError(err, {
      companies_cnpj_key: {
        message: 'CNPJ já cadastrado no sistema.',
        statusCode: 409,
        errorCode: ErrorCodes.DUPLICATE_DOCUMENT,
      },
    });
  }
}

async function updateCompany(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(`SELECT * FROM companies WHERE id = $1 FOR UPDATE`, [id]);
      if (existingRes.rows.length === 0) {
        throw new AppError('Empresa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      const oldCompany = formatCompanyRow(existingRes.rows[0]);

      if (payload.cnpj && payload.cnpj.trim() !== existingRes.rows[0].cnpj) {
        const dup = await client.query(`SELECT id FROM companies WHERE cnpj = $1 AND id <> $2 LIMIT 1`, [
          payload.cnpj.trim(),
          id,
        ]);
        if (dup.rows.length > 0) {
          throw new AppError('CNPJ já utilizado por outra empresa.', 409, ErrorCodes.DUPLICATE_DOCUMENT);
        }
      }

      const { sets, values } = buildDynamicUpdate(payload, COMPANY_UPDATE_MAP);
      if (sets.length === 0) {
        return oldCompany;
      }

      values.push(id);
      const updatedRes = await client.query(
        `UPDATE companies SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      const updated = formatCompanyRow(updatedRes.rows[0]);

      await logAction({
        userId: actorUserId,
        action: 'UPDATE',
        tableName: 'companies',
        recordId: updated.id,
        oldValue: oldCompany,
        newValue: updated,
        ipAddress,
        userAgent,
        client,
      });

      return updated;
    });
  } catch (err) {
    handlePgError(err, {
      companies_cnpj_key: {
        message: 'CNPJ já utilizado por outra empresa.',
        statusCode: 409,
        errorCode: ErrorCodes.DUPLICATE_DOCUMENT,
      },
    });
  }
}

async function softDeleteCompany(id, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM companies WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Empresa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const activeJobsRes = await client.query(
      `SELECT COUNT(*)::INT AS cnt
       FROM job_openings
       WHERE company_id = $1 AND status IN ('Aberta', 'Em Progresso')`,
      [id],
    );
    if (activeJobsRes.rows[0].cnt > 0) {
      throw new AppError(
        'Não é possível inativar empresa com vagas abertas ou em progresso.',
        409,
        ErrorCodes.RESOURCE_CONFLICT,
      );
    }

    const oldCompany = formatCompanyRow(existingRes.rows[0]);
    const updatedRes = await client.query(
      `UPDATE companies SET status = 'Inativo' WHERE id = $1 RETURNING *`,
      [id],
    );
    const updated = formatCompanyRow(updatedRes.rows[0]);

    await logAction({
      userId: actorUserId,
      action: 'DELETE',
      tableName: 'companies',
      recordId: id,
      oldValue: { status: oldCompany.status },
      newValue: { status: 'Inativo' },
      ipAddress,
      userAgent,
      client,
    });

    return updated;
  });
}

module.exports = {
  listCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  softDeleteCompany,
};
