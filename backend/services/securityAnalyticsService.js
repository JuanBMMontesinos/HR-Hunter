const { query } = require('../config/database');
const { mapRow, mapRows } = require('../utils/dbMapper');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { logAction } = require('./auditService');

function classifyRiskLevel(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

function computeRiskScore({
  unauthorizedAttempts = 0,
  failedLogins = 0,
  activeCriticalAlerts = 0,
  activeHighAlerts = 0,
  activeMediumAlerts = 0,
}) {
  const weighted =
    Math.min(unauthorizedAttempts * 2, 30) +
    Math.min(failedLogins * 1.5, 25) +
    activeCriticalAlerts * 25 +
    activeHighAlerts * 12 +
    activeMediumAlerts * 5;

  return Math.min(100, Math.round(weighted));
}

function buildRecommendations({
  unauthorizedAttempts = 0,
  failedLogins = 0,
  activeCriticalAlerts = 0,
  activeHighAlerts = 0,
}) {
  const recommendations = [];

  if (activeCriticalAlerts > 0) {
    recommendations.push(
      'Investigar e bloquear endereços IP envolvidos em alertas CRITICAL ativos.',
    );
  }
  if (activeHighAlerts > 0 || unauthorizedAttempts >= 5) {
    recommendations.push(
      'Revisar permissões granulares dos perfis envolvidos em acessos negados recorrentes.',
    );
  }
  if (failedLogins >= 10) {
    recommendations.push(
      'Auditar tentativas de força bruta em login_history e confirmar política de lockout.',
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Postura de segurança saudável; manter revisão periódica de permissões.');
  }

  return recommendations;
}

async function generateSecurityReport({
  periodStart = null,
  periodEnd = null,
  actorUserId,
  ipAddress = null,
  userAgent = null,
}) {
  const end = periodEnd ? new Date(periodEnd) : new Date();
  const start = periodStart
    ? new Date(periodStart)
    : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [unauthRes, failedRes, alertsRes] = await Promise.all([
    query(
      `SELECT COUNT(*)::INT AS total, COUNT(DISTINCT ip_address)::INT AS unique_ips
       FROM unauthorized_access_log
       WHERE created_at BETWEEN $1 AND $2`,
      [start, end],
    ),
    query(
      `SELECT COUNT(*)::INT AS total
       FROM login_history
       WHERE is_successful = FALSE AND login_time BETWEEN $1 AND $2`,
      [start, end],
    ),
    query(
      `SELECT severity, COUNT(*)::INT AS count
       FROM security_alerts
       WHERE status = 'ACTIVE'
       GROUP BY severity`,
    ),
  ]);

  const activeBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const row of alertsRes.rows) {
    activeBySeverity[row.severity] = row.count;
  }

  const unauthorizedAttempts = unauthRes.rows[0].total;
  const uniqueOffendingIps = unauthRes.rows[0].unique_ips;
  const failedLogins = failedRes.rows[0].total;

  const riskScore = computeRiskScore({
    unauthorizedAttempts,
    failedLogins,
    activeCriticalAlerts: activeBySeverity.CRITICAL,
    activeHighAlerts: activeBySeverity.HIGH,
    activeMediumAlerts: activeBySeverity.MEDIUM,
  });
  const riskLevel = classifyRiskLevel(riskScore);
  const recommendations = buildRecommendations({
    unauthorizedAttempts,
    failedLogins,
    activeCriticalAlerts: activeBySeverity.CRITICAL,
    activeHighAlerts: activeBySeverity.HIGH,
  });

  const reportData = {
    unauthorizedAttempts,
    uniqueOffendingIps,
    failedLogins,
    activeAlertsBySeverity: activeBySeverity,
    recommendations,
  };

  const insertRes = await query(
    `INSERT INTO security_reports (period_start, period_end, report_data, risk_score, risk_level, created_by)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6)
     RETURNING *`,
    [start, end, JSON.stringify(reportData), riskScore, riskLevel, actorUserId],
  );

  const report = mapRow(insertRes.rows[0]);

  await logAction({
    userId: actorUserId,
    action: 'CREATE',
    tableName: 'security_reports',
    recordId: Number(report.id),
    newValue: { riskScore, riskLevel },
    ipAddress,
    userAgent,
  });

  return report;
}

async function listSecurityReports({ page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit || 20)), 100);
  const safePage = Math.max(1, Number(page || 1));
  const offset = (safePage - 1) * safeLimit;

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT sr.*, u.full_name AS created_by_name
       FROM security_reports sr
       LEFT JOIN users u ON u.id = sr.created_by
       ORDER BY sr.generated_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset],
    ),
    query(`SELECT COUNT(*)::INT AS total FROM security_reports`),
  ]);

  return {
    items: mapRows(rowsRes.rows),
    total: countRes.rows[0].total,
    page: safePage,
    limit: safeLimit,
  };
}

async function getSecurityReportById(id) {
  const res = await query(
    `SELECT sr.*, u.full_name AS created_by_name
     FROM security_reports sr
     LEFT JOIN users u ON u.id = sr.created_by
     WHERE sr.id = $1`,
    [Number(id)],
  );

  if (res.rows.length === 0) {
    throw new AppError('Relatório de segurança não encontrado.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  return mapRow(res.rows[0]);
}

module.exports = {
  classifyRiskLevel,
  computeRiskScore,
  buildRecommendations,
  generateSecurityReport,
  listSecurityReports,
  getSecurityReportById,
};
