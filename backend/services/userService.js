const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query, withTransaction } = require('../config/database');
const { mapRows, normalizeOptionalString } = require('../utils/dbMapper');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const {
  parsePagination,
  buildPaginatedResult,
  SqlFilterBuilder,
  handlePgError,
  buildDynamicUpdate,
} = require('../utils/queryHelpers');
const { sanitizeUserDto, getSecuritySettings } = require('./authService');
const { logAction } = require('./auditService');
const { recordUnauthorizedAccess } = require('./securityAlertService');
const { sendMail } = require('./emailService');

const ADMIN_ONLY_UPDATE_FIELDS = new Set([
  'email',
  'role',
  'department',
  'managerId',
  'isActive',
  'hiringDate',
  'isPasswordResetRequired',
]);

const USER_UPDATE_MAP = {
  email: { column: 'email', transform: (v) => String(v).trim().toLowerCase() },
  fullName: { column: 'full_name', transform: (v) => String(v).trim() },
  phone: { column: 'phone', transform: normalizeOptionalString },
  role: 'role',
  department: { column: 'department', transform: normalizeOptionalString },
  managerId: 'manager_id',
  isActive: 'is_active',
  hiringDate: { column: 'hiring_date', transform: normalizeOptionalString },
  preferredLanguage: 'preferred_language',
  isPasswordResetRequired: 'is_password_reset_required',
};

function generateTemporaryPassword() {
  const randomPart = crypto.randomBytes(6).toString('hex');
  return `Hr@${randomPart}9A!`;
}

function formatUserWithManager(row) {
  const dto = sanitizeUserDto(row);
  if (!dto) return null;
  dto.department = row.department ?? dto.department;
  dto.hiringDate = row.hiring_date || null;
  dto.createdAt = row.created_at || null;
  dto.updatedAt = row.updated_at || null;
  if (row.manager_name !== undefined) dto.managerName = row.manager_name || null;
  return dto;
}

async function listUsers(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const fb = new SqlFilterBuilder();

  fb.addEq('u.role', filters.role);
  fb.addIlikeAny(['u.department'], filters.department);
  fb.addIlikeAny(['u.full_name', 'u.email', 'u.department'], filters.search);

  let activeFilter = filters.isActive;
  if ((activeFilter === undefined || activeFilter === '') && filters.status) {
    if (['Ativo', 'active'].includes(filters.status)) activeFilter = true;
    if (['Inativo', 'inactive'].includes(filters.status)) activeFilter = false;
  }
  fb.addBool('u.is_active', activeFilter);

  const where = fb.whereClause();
  const limitParam = fb.nextIndex(limit);
  const offsetParam = fb.nextIndex(offset);

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.department, u.manager_id,
              u.is_active, u.hiring_date, u.preferred_language, u.last_login,
              u.is_password_reset_required, u.created_at, u.updated_at,
              m.full_name AS manager_name
       FROM users u
       LEFT JOIN users m ON m.id = u.manager_id
       ${where}
       ORDER BY u.full_name ASC, u.id ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      fb.params,
    ),
    query(`SELECT COUNT(*)::INT AS total FROM users u ${where}`, fb.params.slice(0, fb.params.length - 2)),
  ]);

  return buildPaginatedResult({
    items: rowsRes.rows.map(formatUserWithManager),
    total: countRes.rows[0].total,
    page,
    limit,
  });
}

async function ensureSelfOrAdmin(targetUserId, actorUser, { endpoint, ipAddress, userAgent, action = 'read' } = {}) {
  if (actorUser.role === 'Admin' || Number(actorUser.id) === Number(targetUserId)) {
    return;
  }
  await recordUnauthorizedAccess({
    userId: Number(actorUser.id),
    userEmail: actorUser.email,
    resource: 'users',
    action,
    endpoint,
    ipAddress,
    userAgent,
  });
  throw new AppError('Acesso negado ao perfil de outro usuário.', 403, ErrorCodes.FORBIDDEN);
}

async function getUserById(targetId, actorUser, meta = {}) {
  await ensureSelfOrAdmin(targetId, actorUser, { ...meta, action: 'read' });

  const res = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.department, u.manager_id,
            u.is_active, u.hiring_date, u.preferred_language, u.last_login,
            u.is_password_reset_required, u.created_at, u.updated_at,
            m.full_name AS manager_name
     FROM users u
     LEFT JOIN users m ON m.id = u.manager_id
     WHERE u.id = $1`,
    [targetId],
  );

  if (res.rows.length === 0) {
    throw new AppError('Usuário não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }
  return formatUserWithManager(res.rows[0]);
}

async function createUser(payload, { actorUserId, ipAddress = null, userAgent = null } = {}) {
  const settings = await getSecuritySettings();
  const policy = validatePasswordStrength(payload.password, { minLength: settings.passwordMinLength });
  if (!policy.valid) {
    throw new AppError(
      'A senha não atende à política de segurança.',
      400,
      ErrorCodes.PASSWORD_POLICY,
      policy.errors,
    );
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(payload.password, 10);

  try {
    return await withTransaction(async (client) => {
      const dup = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [normalizedEmail]);
      if (dup.rows.length > 0) {
        throw new AppError('E-mail já cadastrado para outro usuário.', 409, ErrorCodes.EMAIL_ALREADY_EXISTS);
      }

      if (payload.managerId) {
        const mgr = await client.query(`SELECT id FROM users WHERE id = $1`, [payload.managerId]);
        if (mgr.rows.length === 0) {
          throw new AppError('Gestor (managerId) não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
        }
      }

      const res = await client.query(
        `INSERT INTO users (
           email, password_hash, full_name, phone, role, department, manager_id,
           is_active, hiring_date, preferred_language, is_password_reset_required
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, email, full_name, phone, role, department, manager_id,
                   is_active, hiring_date, preferred_language, last_login,
                   is_password_reset_required, created_at, updated_at`,
        [
          normalizedEmail,
          passwordHash,
          payload.fullName.trim(),
          normalizeOptionalString(payload.phone),
          payload.role,
          normalizeOptionalString(payload.department),
          payload.managerId ?? null,
          payload.isActive !== undefined ? payload.isActive : true,
          normalizeOptionalString(payload.hiringDate),
          payload.preferredLanguage || 'pt-BR',
          Boolean(payload.isPasswordResetRequired),
        ],
      );

      const created = formatUserWithManager(res.rows[0]);
      await logAction({
        userId: actorUserId,
        action: 'CREATE',
        tableName: 'users',
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
      users_email_key: {
        message: 'E-mail já cadastrado para outro usuário.',
        statusCode: 409,
        errorCode: ErrorCodes.EMAIL_ALREADY_EXISTS,
      },
    });
  }
}

async function assertNotLastActiveAdmin(client, userId) {
  const others = await client.query(
    `SELECT COUNT(*)::INT AS cnt FROM users WHERE role = 'Admin' AND is_active = TRUE AND id <> $1`,
    [userId],
  );
  if (others.rows[0].cnt === 0) {
    throw new AppError(
      'Não é possível desativar ou rebaixar o único Administrador ativo do sistema.',
      409,
      ErrorCodes.RESOURCE_CONFLICT,
    );
  }
}

async function updateUser(targetId, payload, actorUser, meta = {}) {
  await ensureSelfOrAdmin(targetId, actorUser, { ...meta, action: 'update' });

  if (actorUser.role !== 'Admin') {
    const forbiddenFields = Object.keys(payload).filter((k) => ADMIN_ONLY_UPDATE_FIELDS.has(k));
    if (forbiddenFields.length > 0) {
      await recordUnauthorizedAccess({
        userId: Number(actorUser.id),
        userEmail: actorUser.email,
        resource: 'users',
        action: 'update',
        endpoint: meta.endpoint,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new AppError(
        `Campos restritos ao Admin não podem ser alterados pelo próprio usuário: ${forbiddenFields.join(', ')}.`,
        403,
        ErrorCodes.FORBIDDEN,
      );
    }
  }

  try {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [targetId]);
      if (existingRes.rows.length === 0) {
        throw new AppError('Usuário não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      const existingRow = existingRes.rows[0];
      const oldUser = formatUserWithManager(existingRow);

      if (
        existingRow.role === 'Admin' &&
        existingRow.is_active &&
        ((payload.role && payload.role !== 'Admin') || payload.isActive === false)
      ) {
        await assertNotLastActiveAdmin(client, targetId);
      }

      if (payload.email && payload.email.trim().toLowerCase() !== existingRow.email.toLowerCase()) {
        const dup = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1`, [
          payload.email.trim().toLowerCase(),
          targetId,
        ]);
        if (dup.rows.length > 0) {
          throw new AppError('E-mail já em uso por outro usuário.', 409, ErrorCodes.EMAIL_ALREADY_EXISTS);
        }
      }

      const { sets, values } = buildDynamicUpdate(payload, USER_UPDATE_MAP);
      if (sets.length === 0) return oldUser;

      values.push(targetId);
      const updatedRes = await client.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}
         RETURNING id, email, full_name, phone, role, department, manager_id,
                   is_active, hiring_date, preferred_language, last_login,
                   is_password_reset_required, created_at, updated_at`,
        values,
      );
      const updated = formatUserWithManager(updatedRes.rows[0]);

      await logAction({
        userId: Number(actorUser.id),
        action: 'UPDATE',
        tableName: 'users',
        recordId: updated.id,
        oldValue: oldUser,
        newValue: updated,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        client,
      });

      return updated;
    });
  } catch (err) {
    handlePgError(err, {
      users_email_key: {
        message: 'E-mail já em uso por outro usuário.',
        statusCode: 409,
        errorCode: ErrorCodes.EMAIL_ALREADY_EXISTS,
      },
    });
  }
}

async function softDeleteUser(targetId, actorUser, meta = {}) {
  if (Number(targetId) === Number(actorUser.id)) {
    throw new AppError('Não é permitido desativar sua própria conta.', 409, ErrorCodes.RESOURCE_CONFLICT);
  }

  return withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [targetId]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Usuário não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    const existingRow = existingRes.rows[0];
    if (existingRow.role === 'Admin' && existingRow.is_active) {
      await assertNotLastActiveAdmin(client, targetId);
    }

    const updatedRes = await client.query(
      `UPDATE users SET is_active = FALSE WHERE id = $1
       RETURNING id, email, full_name, phone, role, department, manager_id,
                 is_active, hiring_date, preferred_language, last_login,
                 is_password_reset_required, created_at, updated_at`,
      [targetId],
    );
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [targetId],
    );

    const updated = formatUserWithManager(updatedRes.rows[0]);
    await logAction({
      userId: Number(actorUser.id),
      action: 'DELETE',
      tableName: 'users',
      recordId: Number(targetId),
      oldValue: { isActive: existingRow.is_active },
      newValue: { isActive: false },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      client,
    });

    return updated;
  });
}

async function getUserActivity(targetId, actorUser, meta = {}) {
  const user = await getUserById(targetId, actorUser, meta);

  const [loginRes, auditRes] = await Promise.all([
    query(
      `SELECT id, email_attempted, login_time, logout_time, ip_address, user_agent, is_successful, failure_reason
       FROM login_history
       WHERE user_id = $1
       ORDER BY login_time DESC
       LIMIT 20`,
      [targetId],
    ),
    query(
      `SELECT id, action, table_name, record_id, ip_address, created_at
       FROM audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [targetId],
    ),
  ]);

  return {
    user,
    recentLogins: mapRows(loginRes.rows).map((r) => ({ ...r, id: Number(r.id) })),
    recentAudit: mapRows(auditRes.rows).map((r) => ({
      ...r,
      id: Number(r.id),
      recordId: r.recordId ? Number(r.recordId) : null,
    })),
  };
}

async function adminResetPassword(
  targetId,
  payload = {},
  { actorUserId, ipAddress = null, userAgent = null } = {},
) {
  const settings = await getSecuritySettings();
  const isGenerated = !payload.newPassword;
  const plainPassword = payload.newPassword || generateTemporaryPassword();

  const policy = validatePasswordStrength(plainPassword, { minLength: settings.passwordMinLength });
  if (!policy.valid) {
    throw new AppError(
      'A nova senha não atende à política de segurança.',
      400,
      ErrorCodes.PASSWORD_POLICY,
      policy.errors,
    );
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const requireResetOnLogin = payload.requireResetOnLogin !== false;

  const updatedUser = await withTransaction(async (client) => {
    const existingRes = await client.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [targetId]);
    if (existingRes.rows.length === 0) {
      throw new AppError('Usuário não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const res = await client.query(
      `UPDATE users
       SET password_hash = $1,
           last_password_change = NOW(),
           is_password_reset_required = $2,
           login_attempts = 0,
           locked_until = NULL
       WHERE id = $3
       RETURNING id, email, full_name, phone, role, department, manager_id,
                 is_active, hiring_date, preferred_language, last_login,
                 is_password_reset_required, created_at, updated_at`,
      [passwordHash, requireResetOnLogin, targetId],
    );

    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [targetId],
    );

    await logAction({
      userId: actorUserId,
      action: 'PASSWORD_CHANGE',
      tableName: 'users',
      recordId: Number(targetId),
      newValue: { resetByAdmin: true, requireResetOnLogin },
      ipAddress,
      userAgent,
      client,
    });

    return formatUserWithManager(res.rows[0]);
  });

  if (payload.sendEmail) {
    await sendMail({
      to: updatedUser.email,
      subject: 'HR Hunter — Redefinição Administrativa de Senha',
      html: `<p>Olá ${updatedUser.fullName},</p><p>Um administrador redefiniu sua senha de acesso ao HR Hunter.</p>`,
      text: `Olá ${updatedUser.fullName}, sua senha de acesso ao HR Hunter foi redefinida pelo administrador.`,
    });
  }

  return {
    message: 'Senha redefinida com sucesso.',
    user: updatedUser,
    requireResetOnLogin,
    ...(isGenerated ? { temporaryPassword: plainPassword } : {}),
  };
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  softDeleteUser,
  getUserActivity,
  adminResetPassword,
};
