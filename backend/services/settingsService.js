const { query, withTransaction } = require('../config/database');
const { mapRow, mapRows, normalizeOptionalString } = require('../utils/dbMapper');
const { sanitizeHtml, renderTemplate } = require('../utils/sanitizer');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const {
  parsePagination,
  buildPaginatedResult,
  SqlFilterBuilder,
  handlePgError,
  buildDynamicUpdate,
} = require('../utils/queryHelpers');
const { logAction } = require('./auditService');
const { sendMail } = require('./emailService');

function parseTypedConfigValue(val, dataType) {
  if (val === null || val === undefined) return null;
  if (dataType === 'int') {
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }
  if (dataType === 'boolean') {
    return String(val).toLowerCase() === 'true';
  }
  if (dataType === 'json') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

// --- General Configurations ---

async function getSettings() {
  const res = await query(
    `SELECT id, config_key, config_value, data_type, category, is_sensitive, updated_at
     FROM configurations
     ORDER BY category ASC, config_key ASC`,
  );

  const items = mapRows(res.rows).map((item) => {
    const maskedValue = item.isSensitive ? '********' : item.configValue;
    return {
      ...item,
      id: Number(item.id),
      configValue: maskedValue,
      typedValue: item.isSensitive ? '********' : parseTypedConfigValue(item.configValue, item.dataType),
    };
  });

  const grouped = {};
  const map = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
    map[item.configKey] = item.typedValue;
  }

  return { items, map, grouped };
}

async function updateSettings(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  const entries = Array.isArray(payload.configs)
    ? payload.configs
    : Object.entries(payload).map(([configKey, configValue]) => ({ configKey, configValue }));

  await withTransaction(async (client) => {
    const updatedKeys = [];

    for (const entry of entries) {
      let targetKey = entry.configKey;
      if (targetKey === 'ThemeColor') targetKey = 'ThemePrimaryColor';
      if (targetKey === 'SMTPPassword' || targetKey === 'EmailSMTPPassword') {
        targetKey = 'EmailSMTPPassword';
      }

      const existingRes = await client.query(
        `SELECT * FROM configurations WHERE config_key = $1 FOR UPDATE`,
        [targetKey],
      );

      if (entry.configValue === '********' && existingRes.rows[0]?.is_sensitive) {
        continue;
      }

      const strVal =
        entry.configValue === null || entry.configValue === undefined
          ? ''
          : typeof entry.configValue === 'object'
            ? JSON.stringify(entry.configValue)
            : String(entry.configValue);

      if (existingRes.rows.length > 0) {
        await client.query(
          `UPDATE configurations SET config_value = $1 WHERE config_key = $2`,
          [strVal, targetKey],
        );
      } else {
        const inferredSensitive =
          entry.isSensitive !== undefined ? entry.isSensitive : /password|secret|token/i.test(targetKey);
        await client.query(
          `INSERT INTO configurations (config_key, config_value, data_type, category, is_sensitive)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            targetKey,
            strVal,
            entry.dataType || 'string',
            entry.category || 'General',
            inferredSensitive,
          ],
        );
      }
      updatedKeys.push(targetKey);
    }

    await logAction({
      userId: actorUserId,
      action: 'UPDATE',
      tableName: 'configurations',
      newValue: { updatedKeys },
      ipAddress,
      userAgent,
      client,
    });
  });

  return getSettings();
}

// --- Stages CRUD ---

async function listStages() {
  const res = await query(
    `SELECT * FROM recruitment_stage_template ORDER BY stage_order ASC, id ASC`,
  );
  return mapRows(res.rows).map((r) => ({ ...r, id: Number(r.id), stageOrder: Number(r.stageOrder) }));
}

async function createStage(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO recruitment_stage_template
           (stage_name, stage_order, is_active, requires_feedback, is_terminal, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          payload.stageName.trim(),
          payload.stageOrder,
          payload.isActive !== undefined ? payload.isActive : true,
          payload.requiresFeedback !== undefined ? payload.requiresFeedback : true,
          payload.isTerminal !== undefined ? payload.isTerminal : false,
          normalizeOptionalString(payload.description),
        ],
      );
      const created = mapRow(res.rows[0]);
      created.id = Number(created.id);
      created.stageOrder = Number(created.stageOrder);

      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'recruitment_stage_template',
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
      recruitment_stage_template_stage_name_key: {
        message: 'Já existe uma etapa com este nome.',
        statusCode: 409,
        errorCode: ErrorCodes.RESOURCE_CONFLICT,
      },
    });
  }
}

const STAGE_UPDATE_MAP = {
  stageName: { column: 'stage_name', transform: (v) => String(v).trim() },
  stageOrder: 'stage_order',
  isActive: 'is_active',
  requiresFeedback: 'requires_feedback',
  isTerminal: 'is_terminal',
  description: { column: 'description', transform: normalizeOptionalString },
};

async function updateStage(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(
        `SELECT * FROM recruitment_stage_template WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (existingRes.rows.length === 0) {
        throw new AppError('Etapa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      const oldStage = mapRow(existingRes.rows[0]);

      const { sets, values } = buildDynamicUpdate(payload, STAGE_UPDATE_MAP);
      if (sets.length === 0) return { ...oldStage, id: Number(oldStage.id) };

      values.push(id);
      const res = await client.query(
        `UPDATE recruitment_stage_template SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
      );
      const updated = mapRow(res.rows[0]);
      updated.id = Number(updated.id);
      updated.stageOrder = Number(updated.stageOrder);

      await logAction({
        userId: actorUserId,
        action: 'UPDATE',
        tableName: 'recruitment_stage_template',
        recordId: updated.id,
        oldValue: oldStage,
        newValue: updated,
        ipAddress,
        userAgent,
        client,
      });
      return updated;
    });
  } catch (err) {
    handlePgError(err, {
      recruitment_stage_template_stage_name_key: {
        message: 'Já existe uma etapa com este nome.',
        statusCode: 409,
        errorCode: ErrorCodes.RESOURCE_CONFLICT,
      },
    });
  }
}

async function deleteStage(id, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(
      `SELECT * FROM recruitment_stage_template WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (existingRes.rows.length === 0) {
      throw new AppError('Etapa não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const procUsage = await client.query(
      `SELECT COUNT(*)::INT AS cnt FROM recruitment_processes WHERE current_stage_id = $1`,
      [id]
    );
    const stageUsage = await client.query(
      `SELECT COUNT(*)::INT AS cnt FROM process_stages WHERE stage_id = $1`,
      [id]
    );
    const funnelUsage = await client.query(
      `SELECT COUNT(*)::INT AS cnt FROM stage_funnel_items WHERE stage_id = $1`,
      [id]
    );

    if (procUsage.rows[0].cnt > 0 || stageUsage.rows[0].cnt > 0 || funnelUsage.rows[0].cnt > 0) {
      throw new AppError(
        'Etapa vinculada a funis ou processos seletivos não pode ser excluída; desative-a.',
        409,
        ErrorCodes.RESOURCE_CONFLICT,
      );
    }

    await client.query(`DELETE FROM recruitment_stage_template WHERE id = $1`, [id]);
    await logAction({
      userId: actorUserId,
      action: 'DELETE',
      tableName: 'recruitment_stage_template',
      recordId: Number(id),
      oldValue: mapRow(existingRes.rows[0]),
      ipAddress,
      userAgent,
      client,
    });

    return { deleted: true, id: Number(id) };
  });
}

// --- Funnels CRUD ---

async function listFunnels() {
  const [funnelsRes, itemsRes] = await Promise.all([
    query(`SELECT * FROM stage_funnels ORDER BY is_default DESC, name ASC`),
    query(
      `SELECT sfi.id, sfi.funnel_id, sfi.stage_id, sfi.stage_order,
              rst.stage_name, rst.requires_feedback, rst.is_terminal, rst.is_active
       FROM stage_funnel_items sfi
       JOIN recruitment_stage_template rst ON rst.id = sfi.stage_id
       ORDER BY sfi.funnel_id ASC, sfi.stage_order ASC`,
    ),
  ]);

  const byFunnel = new Map();
  for (const row of mapRows(itemsRes.rows)) {
    const fId = Number(row.funnelId);
    const list = byFunnel.get(fId) || [];
    list.push({
      id: Number(row.id),
      stageId: Number(row.stageId),
      stageOrder: Number(row.stageOrder),
      stageName: row.stageName,
      requiresFeedback: row.requiresFeedback,
      isTerminal: row.isTerminal,
      isActive: row.isActive,
    });
    byFunnel.set(fId, list);
  }

  return mapRows(funnelsRes.rows).map((f) => {
    const id = Number(f.id);
    return {
      ...f,
      id,
      items: byFunnel.get(id) || [],
    };
  });
}

async function syncFunnelItems(client, funnelId, { stageIds, items }) {
  const resolvedItems = Array.isArray(items)
    ? items.map((item) => ({ stageId: Number(item.stageId), stageOrder: Number(item.stageOrder) }))
    : Array.isArray(stageIds)
      ? stageIds.map((stageId, index) => ({ stageId: Number(stageId), stageOrder: index + 1 }))
      : null;

  if (!resolvedItems) return;

  await client.query(`DELETE FROM stage_funnel_items WHERE funnel_id = $1`, [funnelId]);
  for (const item of resolvedItems) {
    await client.query(
      `INSERT INTO stage_funnel_items (funnel_id, stage_id, stage_order) VALUES ($1, $2, $3)`,
      [funnelId, item.stageId, item.stageOrder],
    );
  }
}

async function createFunnel(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    const funnelId = await withTransaction(async (client) => {
      if (payload.isDefault) {
        await client.query(`UPDATE stage_funnels SET is_default = FALSE WHERE is_default = TRUE`);
      }

      const res = await client.query(
        `INSERT INTO stage_funnels (name, description, is_active, is_default)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          payload.name.trim(),
          normalizeOptionalString(payload.description),
          payload.isActive !== undefined ? payload.isActive : true,
          Boolean(payload.isDefault),
        ],
      );
      const id = Number(res.rows[0].id);

      await syncFunnelItems(client, id, payload);

      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'stage_funnels',
        recordId: id,
        newValue: { ...mapRow(res.rows[0]), id },
        ipAddress,
        userAgent,
        client,
      });

      return id;
    });

    const all = await listFunnels();
    return all.find((f) => f.id === funnelId);
  } catch (err) {
    handlePgError(err, {
      stage_funnels_name_key: {
        message: 'Já existe um funil com este nome.',
        statusCode: 409,
        errorCode: ErrorCodes.RESOURCE_CONFLICT,
      },
    });
  }
}

async function updateFunnel(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    await withTransaction(async (client) => {
      const existingRes = await client.query(`SELECT * FROM stage_funnels WHERE id = $1 FOR UPDATE`, [id]);
      if (existingRes.rows.length === 0) {
        throw new AppError('Funil não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (payload.isDefault === true) {
        await client.query(`UPDATE stage_funnels SET is_default = FALSE WHERE id <> $1`, [id]);
      }

      const { sets, values } = buildDynamicUpdate(payload, {
        name: { column: 'name', transform: (v) => String(v).trim() },
        description: { column: 'description', transform: normalizeOptionalString },
        isActive: 'is_active',
        isDefault: 'is_default',
      });

      if (sets.length > 0) {
        values.push(id);
        await client.query(`UPDATE stage_funnels SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
      }

      await syncFunnelItems(client, id, payload);

      await logAction({
        userId: actorUserId,
        action: 'UPDATE',
        tableName: 'stage_funnels',
        recordId: Number(id),
        oldValue: mapRow(existingRes.rows[0]),
        newValue: payload,
        ipAddress,
        userAgent,
        client,
      });
    });

    const all = await listFunnels();
    return all.find((f) => f.id === Number(id));
  } catch (err) {
    handlePgError(err, {
      stage_funnels_name_key: {
        message: 'Já existe um funil com este nome.',
        statusCode: 409,
        errorCode: ErrorCodes.RESOURCE_CONFLICT,
      },
    });
  }
}

async function deleteFunnel(id, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM stage_funnels WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Funil não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const existing = existingRes.rows[0];
    if (existing.is_default) {
      throw new AppError('O funil padrão não pode ser excluído.', 409, ErrorCodes.RESOURCE_CONFLICT);
    }

    const jobsUsage = await client.query(
      `SELECT COUNT(*)::INT AS cnt FROM job_openings WHERE funnel_id = $1 AND status IN ('Aberta', 'Em Progresso')`,
      [id],
    );
    if (jobsUsage.rows[0].cnt > 0) {
      throw new AppError(
        'Não é possível excluir funil associado a vagas abertas ou em progresso.',
        409,
        ErrorCodes.RESOURCE_CONFLICT,
      );
    }

    await client.query(`DELETE FROM stage_funnels WHERE id = $1`, [id]);
    await logAction({
      userId: actorUserId,
      action: 'DELETE',
      tableName: 'stage_funnels',
      recordId: Number(id),
      oldValue: mapRow(existing),
      ipAddress,
      userAgent,
      client,
    });
    return { deleted: true, id: Number(id) };
  });
}

// --- Email Templates CRUD ---

async function listEmailTemplates() {
  const res = await query(`SELECT * FROM email_templates ORDER BY is_system DESC, name ASC`);
  return mapRows(res.rows).map((t) => ({ ...t, id: Number(t.id) }));
}

async function createEmailTemplate(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  try {
    return await withTransaction(async (client) => {
      const cleanBody = sanitizeHtml(payload.bodyHtml);
      const res = await client.query(
        `INSERT INTO email_templates
           (template_key, name, subject, body_html, variables, language, is_system, is_active)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, FALSE, $7)
         RETURNING *`,
        [
          payload.templateKey.trim(),
          payload.name.trim(),
          payload.subject.trim(),
          cleanBody,
          JSON.stringify(payload.variables || []),
          payload.language || 'pt-BR',
          payload.isActive !== undefined ? payload.isActive : true,
        ],
      );
      const created = mapRow(res.rows[0]);
      created.id = Number(created.id);

      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'email_templates',
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
      email_templates_template_key_key: {
        message: 'Já existe um template de e-mail com esta chave.',
        statusCode: 409,
        errorCode: ErrorCodes.RESOURCE_CONFLICT,
      },
    });
  }
}

async function updateEmailTemplate(id, payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM email_templates WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Template de e-mail não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const oldTpl = mapRow(existingRes.rows[0]);

    const { sets, values } = buildDynamicUpdate(payload, {
      name: { column: 'name', transform: (v) => String(v).trim() },
      subject: { column: 'subject', transform: (v) => String(v).trim() },
      bodyHtml: { column: 'body_html', transform: (v) => sanitizeHtml(v) },
      variables: { column: 'variables', transform: (v) => JSON.stringify(v || []) },
      language: 'language',
      isActive: 'is_active',
    });

    if (sets.length === 0) return { ...oldTpl, id: Number(oldTpl.id) };
    values.push(id);
    const res = await client.query(
      `UPDATE email_templates SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    const updated = mapRow(res.rows[0]);
    updated.id = Number(updated.id);

    await logAction({
      userId: actorUserId,
      action: 'UPDATE',
      tableName: 'email_templates',
      recordId: updated.id,
      oldValue: oldTpl,
      newValue: updated,
      ipAddress,
      userAgent,
      client,
    });
    return updated;
  });
}

async function deleteEmailTemplate(id, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM email_templates WHERE id = $1 FOR UPDATE`, [id]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Template de e-mail não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const existing = existingRes.rows[0];
    if (existing.is_system) {
      throw new AppError(
        'Templates padrão do sistema (isSystem=true) não podem ser excluídos.',
        403,
        ErrorCodes.FORBIDDEN,
      );
    }

    await client.query(`DELETE FROM email_templates WHERE id = $1`, [id]);
    await logAction({
      userId: actorUserId,
      action: 'DELETE',
      tableName: 'email_templates',
      recordId: Number(id),
      oldValue: mapRow(existing),
      ipAddress,
      userAgent,
      client,
    });

    return { deleted: true, id: Number(id) };
  });
}

async function sendTestEmail({ to, templateKey, variables = {} }) {
  let subject = 'HR Hunter — Teste de Envio SMTP';
  let html = '<p>Este é um e-mail de teste disparado pelas configurações do HR Hunter.</p>';

  if (templateKey) {
    const res = await query(`SELECT subject, body_html FROM email_templates WHERE template_key = $1`, [
      templateKey,
    ]);
    if (res.rows.length === 0) {
      throw new AppError('Template de e-mail não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    subject = renderTemplate(res.rows[0].subject, variables);
    html = renderTemplate(res.rows[0].body_html, variables);
  }

  const dispatchResult = await sendMail({ to, subject, html });
  return { to, subject, ...dispatchResult };
}

// --- Audit Log & Login History ---

async function listAuditLog(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const fb = new SqlFilterBuilder();

  fb.addEq('al.user_id', filters.userId ? Number(filters.userId) : null);
  fb.addEq('al.action', filters.action);
  fb.addIlikeAny(['al.table_name'], filters.tableName);
  fb.addDateRange('al.created_at', filters.startDate, filters.endDate);

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT al.id, al.user_id, al.action, al.table_name, al.record_id,
              al.old_value, al.new_value, al.ip_address, al.user_agent, al.created_at,
              u.full_name AS user_name, u.email AS user_email
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(`SELECT COUNT(*)::INT AS total FROM audit_log al ${where}`, fb.params.slice(0, fb.params.length - 2)),
  ]);

  return buildPaginatedResult({
    items: mapRows(rowsRes.rows).map((r) => ({
      ...r,
      id: Number(r.id),
      userId: r.userId ? Number(r.userId) : null,
      recordId: r.recordId ? Number(r.recordId) : null,
    })),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

async function listLoginHistory(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const fb = new SqlFilterBuilder();

  fb.addEq('lh.user_id', filters.userId ? Number(filters.userId) : null);
  fb.addBool('lh.is_successful', filters.isSuccessful);
  fb.addIlikeAny(['lh.email_attempted', 'u.full_name'], filters.email);
  fb.addDateRange('lh.login_time', filters.startDate, filters.endDate);

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT lh.*, u.full_name AS user_name, u.role AS user_role
       FROM login_history lh
       LEFT JOIN users u ON u.id = lh.user_id
       ${where}
       ORDER BY lh.login_time DESC, lh.id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(
      `SELECT COUNT(*)::INT AS total
       FROM login_history lh
       LEFT JOIN users u ON u.id = lh.user_id
       ${where}`,
      fb.params.slice(0, fb.params.length - 2),
    ),
  ]);

  return buildPaginatedResult({
    items: mapRows(rowsRes.rows).map((r) => ({
      ...r,
      id: Number(r.id),
      userId: r.userId ? Number(r.userId) : null,
    })),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

// --- Logical Snapshot / Backup ---

function toSqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function generateBackupSnapshot(
  { format = 'json' } = {},
  { actorUserId, ipAddress = null, userAgent = null } = {},
) {
  const specs = [
    {
      name: 'users',
      sql: `SELECT id, email, full_name, phone, role, department, manager_id, is_active, hiring_date, preferred_language, last_login, created_at FROM users ORDER BY id`,
    },
    { name: 'recruitment_stage_template', sql: `SELECT * FROM recruitment_stage_template ORDER BY id` },
    { name: 'stage_funnels', sql: `SELECT * FROM stage_funnels ORDER BY id` },
    { name: 'stage_funnel_items', sql: `SELECT * FROM stage_funnel_items ORDER BY id` },
    { name: 'companies', sql: `SELECT * FROM companies ORDER BY id` },
    { name: 'job_openings', sql: `SELECT * FROM job_openings ORDER BY id` },
    { name: 'candidates', sql: `SELECT * FROM candidates ORDER BY id` },
    { name: 'candidate_experience', sql: `SELECT * FROM candidate_experience ORDER BY id` },
    { name: 'candidate_education', sql: `SELECT * FROM candidate_education ORDER BY id` },
    { name: 'candidate_skills', sql: `SELECT * FROM candidate_skills ORDER BY id` },
    { name: 'recruitment_processes', sql: `SELECT * FROM recruitment_processes ORDER BY id` },
    { name: 'process_stages', sql: `SELECT * FROM process_stages ORDER BY id` },
    { name: 'offers', sql: `SELECT * FROM offers ORDER BY id` },
    { name: 'email_templates', sql: `SELECT * FROM email_templates ORDER BY id` },
    {
      name: 'configurations',
      sql: `SELECT id, config_key, CASE WHEN is_sensitive THEN '[REDACTED]' ELSE config_value END AS config_value, data_type, category, is_sensitive FROM configurations ORDER BY id`,
    },
    { name: 'permissions', sql: `SELECT * FROM permissions ORDER BY id` },
    { name: 'role_permissions', sql: `SELECT * FROM role_permissions ORDER BY id` },
  ];

  const tables = {};
  const tableCounts = {};

  for (const spec of specs) {
    const res = await query(spec.sql);
    tables[spec.name] = res.rows;
    tableCounts[spec.name] = res.rows.length;
  }

  const generatedAt = new Date().toISOString();
  const metadata = {
    generatedAt,
    format,
    provider: 'Supabase Managed PostgreSQL',
    projectRef: 'fhhgtjzwmhgdiokqqebg',
    managedBackupNote: 'Backup físico contínuo/diário gerenciado pelo Supabase; este artefato é um snapshot lógico auditado.',
  };

  await logAction({
    userId: actorUserId,
    action: 'EXPORT',
    tableName: 'system_backup',
    newValue: { format, generatedAt, tableCounts },
    ipAddress,
    userAgent,
  });

  if (format === 'sql') {
    const lines = [
      `-- HR Hunter Logical Snapshot (${generatedAt})`,
      `-- Supabase Project Ref: fhhgtjzwmhgdiokqqebg`,
      '',
    ];
    for (const [tableName, rows] of Object.entries(tables)) {
      lines.push(`-- Table: ${tableName} (${rows.length} rows)`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => toSqlLiteral(row[c]));
        lines.push(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;`);
      }
      lines.push('');
    }
    return {
      metadata,
      tableCounts,
      sqlContent: lines.join('\n'),
    };
  }

  const mappedTables = {};
  for (const [tableName, rows] of Object.entries(tables)) {
    mappedTables[tableName] = mapRows(rows);
  }

  return {
    metadata,
    tableCounts,
    tables: mappedTables,
  };
}

module.exports = {
  getSettings,
  updateSettings,
  listStages,
  createStage,
  updateStage,
  deleteStage,
  listFunnels,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  sendTestEmail,
  listAuditLog,
  listLoginHistory,
  generateBackupSnapshot,
};
