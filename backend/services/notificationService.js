const { query } = require('../config/database');
const { mapRow, mapRows } = require('../utils/dbMapper');
const { AppError, ErrorCodes } = require('../utils/errorCodes');

async function createNotification({ userId, type, title, message, client = null }) {
  const executor = client ? client.query.bind(client) : query;
  const result = await executor(
    `INSERT INTO notifications (user_id, type, title, message, is_read)
     VALUES ($1, $2, $3, $4, FALSE)
     RETURNING *`,
    [userId, type, title, message],
  );
  return mapRow(result.rows[0]);
}

async function notifyAdmins({ type, title, message, client = null }) {
  const executor = client ? client.query.bind(client) : query;
  const adminsRes = await executor(
    `SELECT id FROM users WHERE role = 'Admin' AND is_active = TRUE`,
  );

  const created = [];
  for (const admin of adminsRes.rows) {
    const row = await createNotification({
      userId: admin.id,
      type,
      title,
      message,
      client,
    });
    created.push(row);
  }
  return created;
}

async function listUserNotifications(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit || 20)), 100);
  const safePage = Math.max(1, Number(page || 1));
  const offset = (safePage - 1) * safeLimit;

  const whereClause = unreadOnly ? 'WHERE user_id = $1 AND is_read = FALSE' : 'WHERE user_id = $1';

  const [listRes, countRes, unreadRes] = await Promise.all([
    query(
      `SELECT id, user_id, type, title, message, is_read, created_at
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset],
    ),
    query(`SELECT COUNT(*)::INT AS total FROM notifications ${whereClause}`, [userId]),
    query(
      `SELECT COUNT(*)::INT AS unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId],
    ),
  ]);

  return {
    items: mapRows(listRes.rows),
    total: countRes.rows[0].total,
    unreadCount: unreadRes.rows[0].unread_count,
    page: safePage,
    limit: safeLimit,
  };
}

async function markAsRead(notificationId, userId) {
  const res = await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, type, title, message, is_read, created_at`,
    [notificationId, userId],
  );

  if (res.rows.length === 0) {
    throw new AppError('Notificação não encontrada.', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  return mapRow(res.rows[0]);
}

async function markAllAsRead(userId) {
  const res = await query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  );
  return { updatedCount: res.rowCount || 0 };
}

module.exports = {
  createNotification,
  notifyAdmins,
  listUserNotifications,
  markAsRead,
  markAllAsRead,
};
