const bcrypt = require('bcrypt');
const { query, withTransaction } = require('../config/database');
const env = require('../config/env');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  parseDurationToMs,
} = require('../utils/tokenUtils');
const { logAction } = require('./auditService');
const { getRolePermissions } = require('./permissionService');
const { createAlert } = require('./securityAlertService');
const { sendPasswordResetEmail } = require('./emailService');

function sanitizeUserDto(userRow) {
  if (!userRow) return null;
  return {
    id: Number(userRow.id),
    email: userRow.email,
    fullName: userRow.full_name,
    phone: userRow.phone,
    role: userRow.role,
    department: userRow.department,
    managerId: userRow.manager_id ? Number(userRow.manager_id) : null,
    isActive: userRow.is_active,
    preferredLanguage: userRow.preferred_language,
    lastLogin: userRow.last_login,
    isPasswordResetRequired: userRow.is_password_reset_required,
  };
}

async function getSecuritySettings() {
  const res = await query(
    `SELECT config_key, config_value
     FROM configurations
     WHERE config_key IN ('MaxLoginAttempts', 'LockoutDuration', 'PasswordMinLength')`,
  );

  const settings = {
    maxLoginAttempts: 5,
    lockoutMinutes: 15,
    passwordMinLength: 8,
  };

  for (const row of res.rows) {
    const num = Number(row.config_value);
    if (!Number.isFinite(num) || num <= 0) continue;
    if (row.config_key === 'MaxLoginAttempts') settings.maxLoginAttempts = num;
    if (row.config_key === 'LockoutDuration') settings.lockoutMinutes = num;
    if (row.config_key === 'PasswordMinLength') settings.passwordMinLength = num;
  }

  return settings;
}

async function recordLoginHistory({
  userId = null,
  emailAttempted,
  ipAddress = null,
  userAgent = null,
  isSuccessful,
  failureReason = null,
  client = null,
}) {
  const executor = client ? client.query.bind(client) : query;
  await executor(
    `INSERT INTO login_history (user_id, email_attempted, ip_address, user_agent, is_successful, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, emailAttempted, ipAddress, userAgent, isSuccessful, failureReason],
  );
}

async function login({ email, password, ipAddress = null, userAgent = null }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const settings = await getSecuritySettings();

  const userRes = await query(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`, [
    normalizedEmail,
  ]);

  if (userRes.rows.length === 0) {
    await recordLoginHistory({
      emailAttempted: normalizedEmail,
      ipAddress,
      userAgent,
      isSuccessful: false,
      failureReason: 'USER_NOT_FOUND',
    });
    throw new AppError('Credenciais inválidas.', 401, ErrorCodes.INVALID_CREDENTIALS);
  }

  const user = userRes.rows[0];

  if (!user.is_active) {
    await recordLoginHistory({
      userId: user.id,
      emailAttempted: normalizedEmail,
      ipAddress,
      userAgent,
      isSuccessful: false,
      failureReason: 'USER_INACTIVE',
    });
    throw new AppError('Conta desativada. Contate o administrador.', 403, ErrorCodes.FORBIDDEN);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await recordLoginHistory({
      userId: user.id,
      emailAttempted: normalizedEmail,
      ipAddress,
      userAgent,
      isSuccessful: false,
      failureReason: 'ACCOUNT_LOCKED',
    });
    throw new AppError(
      'Conta temporariamente bloqueada devido a múltiplas tentativas inválidas.',
      423,
      ErrorCodes.ACCOUNT_LOCKED,
      { lockedUntil: user.locked_until },
    );
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    const newAttempts = Number(user.login_attempts || 0) + 1;
    const shouldLock = newAttempts >= settings.maxLoginAttempts;

    await query(
      `UPDATE users
       SET login_attempts = $1,
           locked_until = CASE WHEN $2 THEN NOW() + ($3 || ' minutes')::interval ELSE NULL END
       WHERE id = $4`,
      [newAttempts, shouldLock, String(settings.lockoutMinutes), user.id],
    );

    await recordLoginHistory({
      userId: user.id,
      emailAttempted: normalizedEmail,
      ipAddress,
      userAgent,
      isSuccessful: false,
      failureReason: shouldLock ? 'ACCOUNT_LOCKED' : 'INVALID_PASSWORD',
    });

    if (shouldLock) {
      await createAlert({
        alertType: 'BRUTE_FORCE_LOCKOUT',
        severity: 'MEDIUM',
        userId: Number(user.id),
        userEmail: user.email,
        ipAddress,
        message: `Conta ${user.email} bloqueada após ${newAttempts} tentativas de login falhas.`,
        details: { attempts: newAttempts, lockoutMinutes: settings.lockoutMinutes },
      });

      throw new AppError(
        `Conta bloqueada por ${settings.lockoutMinutes} minutos após ${newAttempts} tentativas falhas.`,
        423,
        ErrorCodes.ACCOUNT_LOCKED,
      );
    }

    throw new AppError('Credenciais inválidas.', 401, ErrorCodes.INVALID_CREDENTIALS, {
      remainingAttempts: settings.maxLoginAttempts - newAttempts,
    });
  }

  const refreshDurationMs = parseDurationToMs(env.refreshTokenExpiresIn, 7 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(Date.now() + refreshDurationMs);
  const rawRefreshToken = generateOpaqueToken(48);
  const refreshHash = hashToken(rawRefreshToken);

  const updatedUser = await withTransaction(async (client) => {
    const uRes = await client.query(
      `UPDATE users
       SET login_attempts = 0,
           locked_until = NULL,
           last_login = NOW()
       WHERE id = $1
       RETURNING *`,
      [user.id],
    );

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshHash, expiresAt, ipAddress, userAgent],
    );

    await recordLoginHistory({
      userId: user.id,
      emailAttempted: normalizedEmail,
      ipAddress,
      userAgent,
      isSuccessful: true,
      client,
    });

    await logAction({
      userId: Number(user.id),
      action: 'LOGIN',
      tableName: 'users',
      recordId: Number(user.id),
      newValue: { email: user.email, role: user.role },
      ipAddress,
      userAgent,
      client,
    });

    return uRes.rows[0];
  });

  const permissions = await getRolePermissions(updatedUser.role);
  const accessToken = signAccessToken(updatedUser);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    refreshMaxAgeMs: refreshDurationMs,
    expiresIn: env.jwtExpiresIn,
    user: sanitizeUserDto(updatedUser),
    permissions: permissions.map((p) => p.key),
  };
}

async function refreshSession({ rawRefreshToken, ipAddress = null, userAgent = null }) {
  if (!rawRefreshToken) {
    throw new AppError('Refresh token ausente.', 401, ErrorCodes.UNAUTHORIZED);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const refreshDurationMs = parseDurationToMs(env.refreshTokenExpiresIn, 7 * 24 * 60 * 60 * 1000);
  const nextExpiresAt = new Date(Date.now() + refreshDurationMs);
  const nextRawToken = generateOpaqueToken(48);
  const nextHash = hashToken(nextRawToken);

  const result = await withTransaction(async (client) => {
    const existingRes = await client.query(
      `SELECT rt.id AS token_id, rt.user_id, rt.expires_at, rt.revoked_at,
              u.*
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    if (existingRes.rows.length === 0) {
      throw new AppError('Refresh token inválido.', 401, ErrorCodes.INVALID_TOKEN);
    }

    const row = existingRes.rows[0];

    if (row.revoked_at) {
      // Defensive replay guard: revoke all active sessions for the user
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
        [row.user_id],
      );
      throw new AppError('Refresh token já revogado.', 401, ErrorCodes.INVALID_TOKEN);
    }

    if (new Date(row.expires_at) <= new Date()) {
      throw new AppError('Refresh token expirado.', 401, ErrorCodes.TOKEN_EXPIRED);
    }

    if (!row.is_active) {
      throw new AppError('Conta desativada.', 403, ErrorCodes.FORBIDDEN);
    }

    await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.token_id]);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.user_id, nextHash, nextExpiresAt, ipAddress, userAgent],
    );

    return row;
  });

  const permissions = await getRolePermissions(result.role);
  const accessToken = signAccessToken(result);

  return {
    accessToken,
    refreshToken: nextRawToken,
    refreshMaxAgeMs: refreshDurationMs,
    expiresIn: env.jwtExpiresIn,
    user: sanitizeUserDto(result),
    permissions: permissions.map((p) => p.key),
  };
}

async function logout({ rawRefreshToken = null, userId = null, ipAddress = null, userAgent = null }) {
  await withTransaction(async (client) => {
    let resolvedUserId = userId;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      const revRes = await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE token_hash = $1
         RETURNING user_id`,
        [tokenHash],
      );
      if (revRes.rows.length > 0 && !resolvedUserId) {
        resolvedUserId = Number(revRes.rows[0].user_id);
      }
    }

    if (resolvedUserId) {
      await client.query(
        `UPDATE login_history
         SET logout_time = NOW()
         WHERE id = (
           SELECT id FROM login_history
           WHERE user_id = $1 AND is_successful = TRUE AND logout_time IS NULL
           ORDER BY login_time DESC
           LIMIT 1
         )`,
        [resolvedUserId],
      );

      await logAction({
        userId: resolvedUserId,
        action: 'LOGOUT',
        tableName: 'users',
        recordId: resolvedUserId,
        ipAddress,
        userAgent,
        client,
      });
    }
  });
}

async function forgotPassword({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const userRes = await query(
    `SELECT id, email, full_name, is_active FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [normalizedEmail],
  );

  if (userRes.rows.length > 0 && userRes.rows[0].is_active) {
    const user = userRes.rows[0];
    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    const resetUrl = `${env.frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail({
      email: user.email,
      fullName: user.full_name,
      resetUrl,
    });
  }

  return {
    message: 'Se o email existir em nossa base, enviaremos instruções para redefinição de senha.',
  };
}

async function resetPassword({ token, newPassword, ipAddress = null, userAgent = null }) {
  const settings = await getSecuritySettings();
  const policyResult = validatePasswordStrength(newPassword, {
    minLength: settings.passwordMinLength,
  });

  if (!policyResult.valid) {
    throw new AppError(
      'A nova senha não atende à política de segurança.',
      400,
      ErrorCodes.PASSWORD_POLICY,
      policyResult.errors,
    );
  }

  const tokenHash = hashToken(token);
  const newHash = await bcrypt.hash(newPassword, 10);

  await withTransaction(async (client) => {
    const tokenRes = await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    if (tokenRes.rows.length === 0) {
      throw new AppError('Token de redefinição inválido.', 400, ErrorCodes.INVALID_TOKEN);
    }

    const resetRow = tokenRes.rows[0];
    if (resetRow.used_at || new Date(resetRow.expires_at) <= new Date()) {
      throw new AppError('Token de redefinição expirado ou já utilizado.', 400, ErrorCodes.TOKEN_EXPIRED);
    }

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           last_password_change = NOW(),
           is_password_reset_required = FALSE,
           login_attempts = 0,
           locked_until = NULL
       WHERE id = $2`,
      [newHash, resetRow.user_id],
    );

    await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [
      resetRow.id,
    ]);

    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [resetRow.user_id],
    );

    await logAction({
      userId: Number(resetRow.user_id),
      action: 'PASSWORD_CHANGE',
      tableName: 'users',
      recordId: Number(resetRow.user_id),
      newValue: { via: 'password_reset_token' },
      ipAddress,
      userAgent,
      client,
    });
  });

  return {
    message: 'Senha redefinida com sucesso.',
  };
}

module.exports = {
  sanitizeUserDto,
  getSecuritySettings,
  login,
  refreshSession,
  logout,
  forgotPassword,
  resetPassword,
};
