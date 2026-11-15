const { query, withTransaction } = require('../config/database');
const { mapRow, mapRows, normalizeOptionalString } = require('../utils/dbMapper');
const { sanitizeHtml } = require('../utils/sanitizer');
const { parseCsvText } = require('../utils/csvParser');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const {
  parsePagination,
  buildPaginatedResult,
  SqlFilterBuilder,
  handlePgError,
  buildDynamicUpdate,
} = require('../utils/queryHelpers');
const { logAction } = require('./auditService');

const CANDIDATE_CONSTRAINTS = {
  candidates_email_key: {
    message: 'E-mail de candidato já cadastrado.',
    statusCode: 409,
    errorCode: ErrorCodes.EMAIL_ALREADY_EXISTS,
  },
  uq_candidates_cpf_not_null: {
    message: 'CPF já cadastrado para outro candidato.',
    statusCode: 409,
    errorCode: ErrorCodes.DUPLICATE_DOCUMENT,
  },
};

const CANDIDATE_UPDATE_MAP = {
  fullName: 'full_name',
  email: { column: 'email', transform: (v) => String(v).trim().toLowerCase() },
  phone: { column: 'phone', transform: normalizeOptionalString },
  cpf: { column: 'cpf', transform: normalizeOptionalString },
  dateBirth: { column: 'date_birth', transform: normalizeOptionalString },
  gender: { column: 'gender', transform: normalizeOptionalString },
  street: { column: 'street', transform: normalizeOptionalString },
  number: { column: 'number', transform: normalizeOptionalString },
  complement: { column: 'complement', transform: normalizeOptionalString },
  city: { column: 'city', transform: normalizeOptionalString },
  state: { column: 'state', transform: normalizeOptionalString },
  country: { column: 'country', transform: (v) => normalizeOptionalString(v) || 'Brasil' },
  postalCode: { column: 'postal_code', transform: normalizeOptionalString },
  linkedin: { column: 'linkedin', transform: normalizeOptionalString },
  github: { column: 'github', transform: normalizeOptionalString },
  portfolio: { column: 'portfolio', transform: normalizeOptionalString },
  cvFilePath: { column: 'cv_file_path', transform: normalizeOptionalString },
  desiredPosition: { column: 'desired_position', transform: normalizeOptionalString },
  desiredSalary: 'desired_salary',
  availableDate: { column: 'available_date', transform: normalizeOptionalString },
  notes: { column: 'notes', transform: (v) => sanitizeHtml(normalizeOptionalString(v) || '') || null },
  status: 'status',
};

function formatCandidateRow(row) {
  if (!row) return null;
  const mapped = mapRow(row);
  mapped.id = Number(mapped.id);
  if (mapped.desiredSalary !== null && mapped.desiredSalary !== undefined) {
    mapped.desiredSalary = Number(mapped.desiredSalary);
  }
  if (mapped.processCount !== undefined) mapped.processCount = Number(mapped.processCount);
  return mapped;
}

async function assertCandidateExists(candidateId, client = null) {
  const executor = client ? client.query.bind(client) : query;
  const res = await executor(`SELECT * FROM candidates WHERE id = $1`, [candidateId]);
  if (res.rows.length === 0) {
    throw new AppError('Candidato não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  return formatCandidateRow(res.rows[0]);
}

async function listCandidates(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const fb = new SqlFilterBuilder();

  fb.addIlikeAny(['c.full_name', 'c.email', 'c.cpf', 'c.desired_position'], filters.name || filters.search);
  fb.addIlikeAny(['c.email'], filters.email);
  fb.addIlikeAny(['c.cpf'], filters.cpf);
  fb.addEq('c.status', filters.status);

  if (filters.skill && String(filters.skill).trim() !== '') {
    fb.addRaw(
      `EXISTS (SELECT 1 FROM candidate_skills cs_filter WHERE cs_filter.candidate_id = c.id AND cs_filter.skill ILIKE ?)`,
      `%${String(filters.skill).trim()}%`,
    );
  }

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT c.*,
              COALESCE(vw.process_count, 0)::INT AS process_count,
              vw.applied_positions,
              vw.current_stages,
              COALESCE(
                ARRAY_AGG(DISTINCT cs.skill) FILTER (WHERE cs.skill IS NOT NULL),
                '{}'::VARCHAR[]
              ) AS skills
       FROM candidates c
       LEFT JOIN vw_candidate_summary vw ON vw.id = c.id
       LEFT JOIN candidate_skills cs ON cs.candidate_id = c.id
       ${where}
       GROUP BY c.id, vw.process_count, vw.applied_positions, vw.current_stages
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(`SELECT COUNT(*)::INT AS total FROM candidates c ${where}`, fb.params.slice(0, fb.params.length - 2)),
  ]);

  return buildPaginatedResult({
    items: rowsRes.rows.map(formatCandidateRow),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

async function getCandidateById(id) {
  const candidate = await assertCandidateExists(id);

  const [expRes, eduRes, skillRes, procRes] = await Promise.all([
    query(
      `SELECT * FROM candidate_experience WHERE candidate_id = $1 ORDER BY start_date DESC, id DESC`,
      [id],
    ),
    query(
      `SELECT * FROM candidate_education WHERE candidate_id = $1 ORDER BY year_conclusion DESC NULLS FIRST, id DESC`,
      [id],
    ),
    query(`SELECT * FROM candidate_skills WHERE candidate_id = $1 ORDER BY skill ASC`, [id]),
    query(
      `SELECT rp.id, rp.job_opening_id, rp.current_stage_id, rp.status, rp.start_date, rp.end_date,
              jo.title AS job_title,
              co.legal_name AS company_name,
              rst.stage_name AS current_stage_name
       FROM recruitment_processes rp
       JOIN job_openings jo ON jo.id = rp.job_opening_id
       JOIN companies co ON co.id = jo.company_id
       JOIN recruitment_stage_template rst ON rst.id = rp.current_stage_id
       WHERE rp.candidate_id = $1
       ORDER BY rp.start_date DESC`,
      [id],
    ),
  ]);

  return {
    ...candidate,
    experiences: mapRows(expRes.rows).map((e) => ({ ...e, id: Number(e.id), candidateId: Number(e.candidateId) })),
    education: mapRows(eduRes.rows).map((e) => ({ ...e, id: Number(e.id), candidateId: Number(e.candidateId) })),
    skills: mapRows(skillRes.rows).map((s) => ({ ...s, id: Number(s.id), candidateId: Number(s.candidateId) })),
    processes: mapRows(procRes.rows).map((p) => ({
      ...p,
      id: Number(p.id),
      jobOpeningId: Number(p.jobOpeningId),
      currentStageId: Number(p.currentStageId),
    })),
  };
}

async function insertCandidateRow(client, payload) {
  const res = await client.query(
    `INSERT INTO candidates (
       full_name, email, phone, cpf, date_birth, gender, street, number, complement,
       city, state, country, postal_code, linkedin, github, portfolio, cv_file_path,
       desired_position, desired_salary, available_date, notes, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      payload.fullName.trim(),
      payload.email.trim().toLowerCase(),
      normalizeOptionalString(payload.phone),
      normalizeOptionalString(payload.cpf),
      normalizeOptionalString(payload.dateBirth),
      normalizeOptionalString(payload.gender),
      normalizeOptionalString(payload.street),
      normalizeOptionalString(payload.number),
      normalizeOptionalString(payload.complement),
      normalizeOptionalString(payload.city),
      normalizeOptionalString(payload.state),
      normalizeOptionalString(payload.country) || 'Brasil',
      normalizeOptionalString(payload.postalCode),
      normalizeOptionalString(payload.linkedin),
      normalizeOptionalString(payload.github),
      normalizeOptionalString(payload.portfolio),
      normalizeOptionalString(payload.cvFilePath),
      normalizeOptionalString(payload.desiredPosition),
      payload.desiredSalary ?? null,
      normalizeOptionalString(payload.availableDate),
      payload.notes ? sanitizeHtml(payload.notes) : null,
      payload.status || 'Ativo',
    ],
  );
  return formatCandidateRow(res.rows[0]);
}

async function createCandidate(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const created = await insertCandidateRow(client, payload);

      if (Array.isArray(payload.experiences)) {
        for (const exp of payload.experiences) {
          await client.query(
            `INSERT INTO candidate_experience (candidate_id, company, position, start_date, end_date, description, skills)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              created.id,
              exp.company,
              exp.position,
              exp.startDate,
              normalizeOptionalString(exp.endDate),
              normalizeOptionalString(exp.description),
              normalizeOptionalString(exp.skills),
            ],
          );
        }
      }

      if (Array.isArray(payload.education)) {
        for (const edu of payload.education) {
          await client.query(
            `INSERT INTO candidate_education (candidate_id, institution, course, level, year_conclusion, status)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              created.id,
              edu.institution,
              edu.course,
              normalizeOptionalString(edu.level),
              edu.yearConclusion ?? null,
              normalizeOptionalString(edu.status),
            ],
          );
        }
      }

      if (Array.isArray(payload.skills)) {
        for (const sk of payload.skills) {
          await client.query(
            `INSERT INTO candidate_skills (candidate_id, skill, level) VALUES ($1,$2,$3)`,
            [created.id, sk.skill, sk.level || 'Intermediário'],
          );
        }
      }

      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'candidates',
        recordId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
        client,
      });

      return created;
    });
  } catch (err) {
    handlePgError(err, CANDIDATE_CONSTRAINTS);
  }
}

async function updateCandidate(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(`SELECT * FROM candidates WHERE id = $1 FOR UPDATE`, [id]);
      if (existingRes.rows.length === 0) {
        throw new AppError('Candidato não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      const oldCandidate = formatCandidateRow(existingRes.rows[0]);

      const { sets, values } = buildDynamicUpdate(payload, CANDIDATE_UPDATE_MAP);
      if (sets.length === 0) return oldCandidate;

      values.push(id);
      const res = await client.query(
        `UPDATE candidates SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      const updated = formatCandidateRow(res.rows[0]);

      await logAction({
        userId: actorUserId,
        action: 'UPDATE',
        tableName: 'candidates',
        recordId: id,
        oldValue: oldCandidate,
        newValue: updated,
        ipAddress,
        userAgent,
        client,
      });

      return updated;
    });
  } catch (err) {
    handlePgError(err, CANDIDATE_CONSTRAINTS);
  }
}

async function softDeleteCandidate(id, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM candidates WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Candidato não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const activeProcRes = await client.query(
      `SELECT COUNT(*)::INT AS cnt
       FROM recruitment_processes
       WHERE candidate_id = $1 AND status IN ('Em Andamento', 'Parado')`,
      [id],
    );
    if (activeProcRes.rows[0].cnt > 0) {
      throw new AppError(
        'Não é possível inativar candidato vinculado a processo seletivo ativo.',
        409,
        ErrorCodes.RESOURCE_CONFLICT,
      );
    }

    const oldCandidate = formatCandidateRow(existingRes.rows[0]);
    const res = await client.query(
      `UPDATE candidates SET status = 'Inativo' WHERE id = $1 RETURNING *`,
      [id],
    );
    const updated = formatCandidateRow(res.rows[0]);

    await logAction({
      userId: actorUserId,
      action: 'DELETE',
      tableName: 'candidates',
      recordId: id,
      oldValue: { status: oldCandidate.status },
      newValue: { status: 'Inativo' },
      ipAddress,
      userAgent,
      client,
    });

    return updated;
  });
}

// --- Sub-resources (Experience, Education, Skills) ---

const SUBRESOURCE_CONFIG = {
  experience: {
    table: 'candidate_experience',
    orderBy: 'start_date DESC, id DESC',
    columns: ['company', 'position', 'start_date', 'end_date', 'description', 'skills'],
    updateMap: {
      company: 'company',
      position: 'position',
      startDate: 'start_date',
      endDate: { column: 'end_date', transform: normalizeOptionalString },
      description: { column: 'description', transform: normalizeOptionalString },
      skills: { column: 'skills', transform: normalizeOptionalString },
    },
    extractValues: (candidateId, p) => [
      candidateId,
      p.company,
      p.position,
      p.startDate,
      normalizeOptionalString(p.endDate),
      normalizeOptionalString(p.description),
      normalizeOptionalString(p.skills),
    ],
  },
  education: {
    table: 'candidate_education',
    orderBy: 'year_conclusion DESC NULLS FIRST, id DESC',
    columns: ['institution', 'course', 'level', 'year_conclusion', 'status'],
    updateMap: {
      institution: 'institution',
      course: 'course',
      level: { column: 'level', transform: normalizeOptionalString },
      yearConclusion: 'year_conclusion',
      status: { column: 'status', transform: normalizeOptionalString },
    },
    extractValues: (candidateId, p) => [
      candidateId,
      p.institution,
      p.course,
      normalizeOptionalString(p.level),
      p.yearConclusion ?? null,
      normalizeOptionalString(p.status),
    ],
  },
  skills: {
    table: 'candidate_skills',
    orderBy: 'skill ASC, id DESC',
    columns: ['skill', 'level'],
    updateMap: {
      skill: 'skill',
      level: 'level',
    },
    extractValues: (candidateId, p) => [candidateId, p.skill, p.level || 'Intermediário'],
  },
};

async function listSubResource(candidateId, type) {
  await assertCandidateExists(candidateId);
  const cfg = SUBRESOURCE_CONFIG[type];
  const res = await query(
    `SELECT * FROM ${cfg.table} WHERE candidate_id = $1 ORDER BY ${cfg.orderBy}`,
    [candidateId],
  );
  return mapRows(res.rows).map((r) => ({ ...r, id: Number(r.id), candidateId: Number(r.candidateId) }));
}

async function addSubResource(candidateId, type, payload, meta = {}) {
  const cfg = SUBRESOURCE_CONFIG[type];
  return withTransaction(async (client) => {
    await assertCandidateExists(candidateId, client);
    const cols = ['candidate_id', ...cfg.columns];
    const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(',');
    const res = await client.query(
      `INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
      cfg.extractValues(candidateId, payload),
    );
    const created = mapRow(res.rows[0]);
    created.id = Number(created.id);
    created.candidateId = Number(created.candidateId);

    await logAction({
      userId: meta.actorUserId,
      action: 'CREATE',
      tableName: cfg.table,
      recordId: created.id,
      newValue: created,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      client,
    });
    return created;
  });
}

async function updateSubResource(candidateId, type, itemId, payload, meta = {}) {
  const cfg = SUBRESOURCE_CONFIG[type];
  return withTransaction(async (client) => {
    await assertCandidateExists(candidateId, client);
    const existingRes = await client.query(
      `SELECT * FROM ${cfg.table} WHERE id = $1 AND candidate_id = $2 FOR UPDATE`,
      [itemId, candidateId],
    );
    if (existingRes.rows.length === 0) {
      throw new AppError('Registro de candidato não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const oldItem = mapRow(existingRes.rows[0]);
    const { sets, values } = buildDynamicUpdate(payload, cfg.updateMap);
    if (sets.length === 0) return oldItem;

    values.push(itemId, candidateId);
    const res = await client.query(
      `UPDATE ${cfg.table}
       SET ${sets.join(', ')}
       WHERE id = $${values.length - 1} AND candidate_id = $${values.length}
       RETURNING *`,
      values,
    );
    const updated = mapRow(res.rows[0]);
    updated.id = Number(updated.id);
    updated.candidateId = Number(updated.candidateId);

    await logAction({
      userId: meta.actorUserId,
      action: 'UPDATE',
      tableName: cfg.table,
      recordId: updated.id,
      oldValue: oldItem,
      newValue: updated,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      client,
    });
    return updated;
  });
}

async function deleteSubResource(candidateId, type, itemId, meta = {}) {
  const cfg = SUBRESOURCE_CONFIG[type];
  return withTransaction(async (client) => {
    await assertCandidateExists(candidateId, client);
    const res = await client.query(
      `DELETE FROM ${cfg.table} WHERE id = $1 AND candidate_id = $2 RETURNING *`,
      [itemId, candidateId],
    );
    if (res.rows.length === 0) {
      throw new AppError('Registro de candidato não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await logAction({
      userId: meta.actorUserId,
      action: 'DELETE',
      tableName: cfg.table,
      recordId: Number(itemId),
      oldValue: mapRow(res.rows[0]),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      client,
    });
    return { deleted: true, id: Number(itemId) };
  });
}

// --- CSV Import ---

function normalizeCsvCandidateRow(raw) {
  const pick = (...keys) => {
    for (const k of keys) {
      const found = Object.keys(raw).find((rk) => rk.toLowerCase() === k.toLowerCase());
      if (found && raw[found] !== undefined && raw[found] !== '') return String(raw[found]).trim();
    }
    return null;
  };

  const fullName = pick('fullName', 'full_name', 'nome', 'name');
  const email = pick('email', 'e-mail');
  const salaryRaw = pick('desiredSalary', 'desired_salary', 'salario', 'salary');
  const salaryNum = salaryRaw ? Number(salaryRaw.replace(',', '.')) : null;

  return {
    rowNumber: raw._rowNumber,
    fullName,
    email: email ? email.toLowerCase() : null,
    phone: pick('phone', 'telefone'),
    cpf: normalizeOptionalString(pick('cpf')),
    city: pick('city', 'cidade'),
    state: pick('state', 'estado', 'uf'),
    desiredPosition: pick('desiredPosition', 'desired_position', 'cargo'),
    desiredSalary: Number.isFinite(salaryNum) ? salaryNum : null,
    status: pick('status') || 'Ativo',
    notes: pick('notes', 'observacoes'),
  };
}

async function importCandidatesFromCsv(csvText, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  const parsedRows = parseCsvText(csvText);
  if (parsedRows.length === 0) {
    throw new AppError('CSV vazio ou sem registros válidos após o cabeçalho.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  return withTransaction(async (client) => {
    const imported = [];
    const errors = [];

    for (let idx = 0; idx < parsedRows.length; idx += 1) {
      const candidateData = normalizeCsvCandidateRow(parsedRows[idx]);
      if (!candidateData.fullName || !candidateData.email || !candidateData.email.includes('@')) {
        errors.push({
          row: candidateData.rowNumber || idx + 2,
          email: candidateData.email,
          error: 'Campos obrigatórios inválidos ou ausentes (fullName, email).',
        });
        continue;
      }

      const spName = `sp_csv_row_${idx}`;
      await client.query(`SAVEPOINT ${spName}`);
      try {
        const created = await insertCandidateRow(client, candidateData);
        imported.push(created);
        await client.query(`RELEASE SAVEPOINT ${spName}`);
      } catch (rowErr) {
        await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
        await client.query(`RELEASE SAVEPOINT ${spName}`);
        errors.push({
          row: candidateData.rowNumber || idx + 2,
          email: candidateData.email,
          error:
            rowErr.constraint === 'candidates_email_key'
              ? 'E-mail já cadastrado.'
              : rowErr.constraint === 'uq_candidates_cpf_not_null'
                ? 'CPF já cadastrado.'
                : rowErr.message,
        });
      }
    }

    await logAction({
      userId: actorUserId,
      action: 'CREATE',
      tableName: 'candidates',
      newValue: {
        source: 'CSV_IMPORT',
        importedCount: imported.length,
        failedCount: errors.length,
        createdIds: imported.map((c) => c.id),
      },
      ipAddress,
      userAgent,
      client,
    });

    return {
      importedCount: imported.length,
      failedCount: errors.length,
      createdIds: imported.map((c) => c.id),
      items: imported,
      errors,
    };
  });
}

module.exports = {
  listCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  softDeleteCandidate,
  listSubResource,
  addSubResource,
  updateSubResource,
  deleteSubResource,
  importCandidatesFromCsv,
};
