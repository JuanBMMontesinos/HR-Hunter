const cron = require('node-cron');
const { query, withTransaction } = require('../config/database');
const env = require('../config/env');
const { mapRow, mapRows } = require('../utils/dbMapper');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { logAction } = require('./auditService');

const POLICY_DEFINITIONS = {
  RetentionAuditLogDays: {
    table: 'audit_log',
    dateColumn: 'created_at',
    extraCondition: '',
    defaultDays: 90,
  },
  RetentionUnauthorizedAccessDays: {
    table: 'unauthorized_access_log',
    dateColumn: 'created_at',
    extraCondition: '',
    defaultDays: 180,
  },
  RetentionLoginHistoryDays: {
    table: 'login_history',
    dateColumn: 'login_time',
    extraCondition: '',
    defaultDays: 365,
  },
  RetentionSecurityAlertsDays: {
    table: 'security_alerts',
    dateColumn: 'created_at',
    extraCondition: `AND status <> 'ACTIVE'`,
    defaultDays: 365,
  },
  RetentionNotificationsDays: {
    table: 'notifications',
    dateColumn: 'created_at',
    extraCondition: `AND is_read = TRUE`,
    defaultDays: 30,
  },
};

let scheduledTask = null;

async function listPolicies() {
  const res = await query(
    `SELECT id, config_key, config_value, data_type, category, updated_at
     FROM configurations
     WHERE category = 'Retention'
     ORDER BY config_key ASC`,
  );

  const items = await Promise.all(
    res.rows.map(async (row) => {
      const def = POLICY_DEFINITIONS[row.config_key];
      const days = Number(row.config_value) || (def ? def.defaultDays : 90);
      let eligibleForCleanup = 0;

      if (def) {
        const countRes = await query(
          `SELECT COUNT(*)::INT AS c
           FROM ${def.table}
           WHERE ${def.dateColumn} < NOW() - ($1 || ' days')::interval
           ${def.extraCondition}`,
          [String(days)],
        );
        eligibleForCleanup = countRes.rows[0].c;
      }

      return {
        ...mapRow(row),
        days,
        eligibleForCleanup,
      };
    }),
  );

  return items;
}

async function updatePolicy({ key, days, actorUserId, ipAddress = null, userAgent = null }) {
  if (!Object.prototype.hasOwnProperty.call(POLICY_DEFINITIONS, key)) {
    throw new AppError(`Política de retenção desconhecida: ${key}`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const oldRes = await query(`SELECT config_value FROM configurations WHERE config_key = $1`, [key]);
  const oldDays = oldRes.rows[0]?.config_value || null;

  const updatedRes = await query(
    `UPDATE configurations
     SET config_value = $1
     WHERE config_key = $2
     RETURNING id, config_key, config_value, data_type, category, updated_at`,
    [String(days), key],
  );

  if (updatedRes.rows.length === 0) {
    throw new AppError(`Política de retenção não cadastrada: ${key}`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const policy = mapRow(updatedRes.rows[0]);

  await logAction({
    userId: actorUserId,
    action: 'UPDATE',
    tableName: 'configurations',
    recordId: Number(policy.id),
    oldValue: { key, days: Number(oldDays) },
    newValue: { key, days: Number(days) },
    ipAddress,
    userAgent,
  });

  return {
    ...policy,
    days: Number(days),
  };
}

async function executeRetention({
  dryRun = false,
  actorUserId = null,
  ipAddress = null,
  userAgent = null,
} = {}) {
  const policies = await listPolicies();
  const policySummary = {};
  let totalDeleted = 0;

  await withTransaction(async (client) => {
    for (const p of policies) {
      const def = POLICY_DEFINITIONS[p.configKey];
      if (!def) continue;

      if (dryRun) {
        policySummary[p.configKey] = {
          days: p.days,
          wouldDelete: p.eligibleForCleanup,
          deleted: 0,
        };
      } else {
        const delRes = await client.query(
          `DELETE FROM ${def.table}
           WHERE ${def.dateColumn} < NOW() - ($1 || ' days')::interval
           ${def.extraCondition}`,
          [String(p.days)],
        );
        const count = delRes.rowCount || 0;
        totalDeleted += count;
        policySummary[p.configKey] = { days: p.days, deleted: count };
      }
    }

    if (!dryRun) {
      const rtDel = await client.query(
        `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`,
      );
      const prtDel = await client.query(
        `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL`,
      );
      const tokenCleanupCount = (rtDel.rowCount || 0) + (prtDel.rowCount || 0);
      totalDeleted += tokenCleanupCount;
      policySummary.expiredTokens = { deleted: tokenCleanupCount };

      await client.query(
        `INSERT INTO retention_execution_log (executed_by, policy_summary, records_deleted)
         VALUES ($1, $2::jsonb, $3)`,
        [actorUserId, JSON.stringify(policySummary), totalDeleted],
      );

      await logAction({
        userId: actorUserId,
        action: 'RETENTION',
        tableName: 'retention_execution_log',
        newValue: { dryRun: false, totalDeleted, policySummary },
        ipAddress,
        userAgent,
        client,
      });
    }
  });

  return {
    dryRun,
    recordsDeleted: totalDeleted,
    policySummary,
    executedAt: new Date().toISOString(),
  };
}

async function getRetentionHistory({ page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit || 20)), 100);
  const safePage = Math.max(1, Number(page || 1));
  const offset = (safePage - 1) * safeLimit;

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT rel.*, u.full_name AS executed_by_name
       FROM retention_execution_log rel
       LEFT JOIN users u ON u.id = rel.executed_by
       ORDER BY rel.executed_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, offset],
    ),
    query(`SELECT COUNT(*)::INT AS total FROM retention_execution_log`),
  ]);

  return {
    items: mapRows(rowsRes.rows),
    total: countRes.rows[0].total,
    page: safePage,
    limit: safeLimit,
  };
}

function startRetentionScheduler() {
  if (!env.enableRetentionCron || scheduledTask) return null;

  scheduledTask = cron.schedule(
    env.retentionCronSchedule,
    async () => {
      try {
        const result = await executeRetention({ dryRun: false });
        logger.info('Scheduled retention job finished', result);
      } catch (err) {
        logger.error('Scheduled retention job failed', { message: err.message });
      }
    },
    { timezone: env.tz },
  );

  logger.info('Retention cron scheduler started', {
    schedule: env.retentionCronSchedule,
    timezone: env.tz,
  });

  return scheduledTask;
}

function stopRetentionScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = {
  POLICY_DEFINITIONS,
  listPolicies,
  updatePolicy,
  executeRetention,
  getRetentionHistory,
  startRetentionScheduler,
  stopRetentionScheduler,
};
