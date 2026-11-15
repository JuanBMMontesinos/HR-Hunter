const { query } = require('../config/database');
const { mapRow } = require('../utils/dbMapper');
const logger = require('../utils/logger');

const VALID_AUDIT_ACTIONS = new Set([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'EXPORT',
  'PERMISSION_CHANGE',
  'RETENTION',
]);

const SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'password_hash', 'newPassword', 'token']);

function redactSensitiveValues(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map(redactSensitiveValues);
  }
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    clean[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : redactSensitiveValues(value);
  }
  return clean;
}

async function logAction({
  userId = null,
  action,
  tableName = null,
  recordId = null,
  oldValue = null,
  newValue = null,
  ipAddress = null,
  userAgent = null,
  client = null,
}) {
  if (!VALID_AUDIT_ACTIONS.has(action)) {
    throw new Error(`Invalid audit action: ${action}`);
  }

  const executor = client ? client.query.bind(client) : query;
  const sanitizedOld = oldValue !== null && oldValue !== undefined ? JSON.stringify(redactSensitiveValues(oldValue)) : null;
  const sanitizedNew = newValue !== null && newValue !== undefined ? JSON.stringify(redactSensitiveValues(newValue)) : null;

  try {
    const result = await executor(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       RETURNING *`,
      [userId, action, tableName, recordId, sanitizedOld, sanitizedNew, ipAddress, userAgent],
    );
    return mapRow(result.rows[0]);
  } catch (err) {
    logger.error('Failed to persist audit_log entry', { action, tableName, message: err.message });
    if (client) throw err;
    return null;
  }
}

module.exports = {
  VALID_AUDIT_ACTIONS,
  redactSensitiveValues,
  logAction,
};
