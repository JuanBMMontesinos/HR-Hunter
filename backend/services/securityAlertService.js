const { query } = require('../config/database');
const { mapRow, mapRows } = require('../utils/dbMapper');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { notifyAdmins } = require('./notificationService');
const { logAction } = require('./auditService');

const USER_HOURLY_THRESHOLD = 5;
const IP_HOURLY_THRESHOLD = 10;

function evaluateAlertThresholds({
  userAttemptsLastHour = 0,
  ipAttemptsLastHour = 0,
  userEmail = null,
  ipAddress = null,
}) {
  const alertsToCreate = [];

  if (userAttemptsLastHour >= USER_HOURLY_THRESHOLD) {
    const actorLabel = userEmail || 'desconhecido';
    alertsToCreate.push({
      alertType: 'REPEATED_UNAUTHORIZED_USER',
      severity: 'HIGH',
      message: `Usuário ${actorLabel} registrou ${userAttemptsLastHour} tentativas de acesso não autorizado na última hora.`,
    });
  }

  if (ipAttemptsLastHour >= IP_HOURLY_THRESHOLD) {
    const ipLabel = ipAddress || 'desconhecido';
    alertsToCreate.push({
      alertType: 'SUSPICIOUS_IP_ACTIVITY',
      severity: 'CRITICAL',
      message: `IP ${ipLabel} registrou ${ipAttemptsLastHour} tentativas de acesso não autorizado na última hora.`,
    });
  }

  return alertsToCreate;
}

async function createAlert({
  alertType,
  severity,
  userId = null,
  userEmail = null,
  ipAddress = null,
  message,
  details = null,
  client = null,
}) {
  const executor = client ? client.query.bind(client) : query;
  const detailsJson = details ? JSON.stringify(details) : null;

  const res = await executor(
    `INSERT INTO security_alerts (alert_type, severity, user_id, user_email, ip_address, message, details, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'ACTIVE')
     RETURNING *`,
    [alertType, severity, userId, userEmail, ipAddress, message, detailsJson],
  );

  const alert = mapRow(res.rows[0]);

  if (severity === 'HIGH' || severity === 'CRITICAL') {
    await notifyAdmins({
      type: `SECURITY_ALERT_${severity}`,
      title: `Alerta de Segurança (${severity})`,
      message,
      client,
    });
  }

  return alert;
}

async function hasRecentActiveAlert({ alertType, userId, ipAddress }) {
  if (alertType === 'REPEATED_UNAUTHORIZED_USER' && userId) {
    const res = await query(
      `SELECT id FROM security_alerts
       WHERE alert_type = $1 AND user_id = $2 AND status = 'ACTIVE'
         AND created_at >= NOW() - INTERVAL '1 hour'
       LIMIT 1`,
      [alertType, userId],
    );
    return res.rows.length > 0;
  }

  if (alertType === 'SUSPICIOUS_IP_ACTIVITY' && ipAddress) {
    const res = await query(
      `SELECT id FROM security_alerts
       WHERE alert_type = $1 AND ip_address = $2 AND status = 'ACTIVE'
         AND created_at >= NOW() - INTERVAL '1 hour'
       LIMIT 1`,
      [alertType, ipAddress],
    );
    return res.rows.length > 0;
  }

  return false;
}

async function recordUnauthorizedAccess({
  userId = null,
  userEmail = null,
  resource,
  action,
  endpoint = null,
  ipAddress = null,
  userAgent = null,
}) {
  const inserted = await query(
    `INSERT INTO unauthorized_access_log (user_id, user_email, resource, action, endpoint, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, userEmail, resource, action, endpoint, ipAddress, userAgent],
  );

  let userAttemptsLastHour = 0;
  let ipAttemptsLastHour = 0;

  if (userId) {
    const uRes = await query(
      `SELECT COUNT(*)::INT AS c FROM unauthorized_access_log
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [userId],
    );
    userAttemptsLastHour = uRes.rows[0].c;
  }

  if (ipAddress) {
    const ipRes = await query(
      `SELECT COUNT(*)::INT AS c FROM unauthorized_access_log
       WHERE ip_address = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [ipAddress],
    );
    ipAttemptsLastHour = ipRes.rows[0].c;
  }

  const triggered = evaluateAlertThresholds({
    userAttemptsLastHour,
    ipAttemptsLastHour,
    userEmail,
    ipAddress,
  });
  for (const spec of triggered) {
    const alreadyExists = await hasRecentActiveAlert({
      alertType: spec.alertType,
      userId,
      ipAddress,
    });
    if (!alreadyExists) {
      await createAlert({
        alertType: spec.alertType,
        severity: spec.severity,
        userId,
        userEmail,
        ipAddress,
        message: spec.message,
        details: {
          resource,
          action,
          endpoint,
          userAttemptsLastHour,
          ipAttemptsLastHour,
        },
      });
    }
  }

  return mapRow(inserted.rows[0]);
}

async function listAlerts({
  status,
  severity,
  alertType,
  startDate,
  endDate,
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit || 20)), 100);
  const safePage = Math.max(1, Number(page || 1));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`sa.status = $${params.length}`);
  }
  if (severity) {
    params.push(severity);
    conditions.push(`sa.severity = $${params.length}`);
  }
  if (alertType) {
    params.push(alertType);
    conditions.push(`sa.alert_type = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`sa.created_at >= $${params.length}::timestamptz`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`sa.created_at <= $${params.length}::timestamptz`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT sa.*, u.full_name AS resolved_by_name
       FROM security_alerts sa
       LEFT JOIN users u ON u.id = sa.resolved_by
       ${whereSql}
       ORDER BY sa.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, offset],
    ),
    query(`SELECT COUNT(*)::INT AS total FROM security_alerts sa ${whereSql}`, params),
  ]);

  return {
    items: mapRows(rowsRes.rows),
    total: countRes.rows[0].total,
    page: safePage,
    limit: safeLimit,
  };
}

async function resolveAlert({
  alertId,
  status = 'RESOLVED',
  resolutionNote = null,
  actorUserId,
  ipAddress = null,
  userAgent = null,
}) {
  const existingRes = await query(`SELECT * FROM security_alerts WHERE id = $1`, [alertId]);
  if (existingRes.rows.length === 0) {
    throw new AppError('Alerta de segurança não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const oldRow = existingRes.rows[0];
  const mergedDetails = {
    ...(oldRow.details || {}),
    ...(resolutionNote ? { resolutionNote } : {}),
  };

  const updatedRes = await query(
    `UPDATE security_alerts
     SET status = $1,
         resolved_at = NOW(),
         resolved_by = $2,
         details = $3::jsonb
     WHERE id = $4
     RETURNING *`,
    [status, actorUserId, JSON.stringify(mergedDetails), alertId],
  );

  const updated = mapRow(updatedRes.rows[0]);

  await logAction({
    userId: actorUserId,
    action: 'UPDATE',
    tableName: 'security_alerts',
    recordId: Number(alertId),
    oldValue: { status: oldRow.status },
    newValue: { status: updated.status, resolutionNote },
    ipAddress,
    userAgent,
  });

  return updated;
}

async function getSecurityStats() {
  const [statusRes, severityRes, unauthRes, topIpsRes, topResRes] = await Promise.all([
    query(`SELECT status, COUNT(*)::INT AS count FROM security_alerts GROUP BY status`),
    query(
      `SELECT severity, COUNT(*)::INT AS count FROM security_alerts WHERE status = 'ACTIVE' GROUP BY severity`,
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::INT AS last_24h,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::INT AS last_7d,
         COUNT(*)::INT AS total
       FROM unauthorized_access_log`,
    ),
    query(
      `SELECT COALESCE(ip_address, 'unknown') AS ip_address, COUNT(*)::INT AS attempts
       FROM unauthorized_access_log
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY ip_address
       ORDER BY attempts DESC
       LIMIT 5`,
    ),
    query(
      `SELECT resource, action, COUNT(*)::INT AS attempts
       FROM unauthorized_access_log
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY resource, action
       ORDER BY attempts DESC
       LIMIT 5`,
    ),
  ]);

  const byStatus = { ACTIVE: 0, RESOLVED: 0, DISMISSED: 0 };
  for (const row of statusRes.rows) {
    byStatus[row.status] = row.count;
  }

  const activeBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const row of severityRes.rows) {
    activeBySeverity[row.severity] = row.count;
  }

  return {
    totalActive: byStatus.ACTIVE,
    byStatus,
    activeBySeverity,
    unauthorizedAttempts: mapRow(unauthRes.rows[0]),
    topOffendingIps: mapRows(topIpsRes.rows),
    topAttemptedResources: mapRows(topResRes.rows),
  };
}

module.exports = {
  USER_HOURLY_THRESHOLD,
  IP_HOURLY_THRESHOLD,
  evaluateAlertThresholds,
  createAlert,
  recordUnauthorizedAccess,
  listAlerts,
  resolveAlert,
  getSecurityStats,
};
