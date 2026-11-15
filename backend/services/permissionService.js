const { query, withTransaction } = require('../config/database');
const { mapRows } = require('../utils/dbMapper');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { logAction } = require('./auditService');

const CACHE_TTL_MS = 5 * 60 * 1000;
const VALID_ROLES = ['Admin', 'Gerente', 'Recrutador', 'Consultor', 'GestorRH'];
const EDITABLE_ROLES = ['Gerente', 'Recrutador', 'Consultor', 'GestorRH'];

const rolePermissionsCache = new Map();

function invalidateCache(role = null) {
  if (role) {
    rolePermissionsCache.delete(role);
  } else {
    rolePermissionsCache.clear();
  }
}

async function getRolePermissions(role, { bypassCache = false } = {}) {
  if (!VALID_ROLES.includes(role)) {
    return [];
  }

  const now = Date.now();
  if (!bypassCache) {
    const cached = rolePermissionsCache.get(role);
    if (cached && now < cached.expiresAt) {
      return cached.items;
    }
  }

  const res = await query(
    `SELECT p.id, p.resource, p.action, p.description
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role = $1
     ORDER BY p.resource ASC, p.action ASC`,
    [role],
  );

  const items = mapRows(res.rows).map((row) => ({
    ...row,
    key: `${row.resource}:${row.action}`,
  }));

  rolePermissionsCache.set(role, {
    items,
    cachedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  });

  return items;
}

async function hasPermission(role, resource, action) {
  const items = await getRolePermissions(role);
  return items.some((perm) => perm.resource === resource && perm.action === action);
}

async function getPermissionsMatrix() {
  const [permsRes, matrixRes] = await Promise.all([
    query(`SELECT id, resource, action, description FROM permissions ORDER BY resource ASC, action ASC`),
    query(`SELECT role, permission_id FROM role_permissions ORDER BY role ASC, permission_id ASC`),
  ]);

  const permissions = mapRows(permsRes.rows).map((p) => ({
    ...p,
    key: `${p.resource}:${p.action}`,
  }));

  const matrix = {};
  for (const role of VALID_ROLES) {
    matrix[role] = {
      editable: role !== 'Admin',
      permissionIds: [],
      keys: [],
    };
  }

  const permById = new Map(permissions.map((p) => [String(p.id), p]));
  for (const row of matrixRes.rows) {
    const perm = permById.get(String(row.permission_id));
    if (perm && matrix[row.role]) {
      matrix[row.role].permissionIds.push(Number(perm.id));
      matrix[row.role].keys.push(perm.key);
    }
  }

  const resources = [...new Set(permissions.map((p) => p.resource))];
  const actions = ['create', 'read', 'update', 'delete'];

  return {
    roles: VALID_ROLES,
    editableRoles: EDITABLE_ROLES,
    resources,
    actions,
    permissions,
    matrix,
  };
}

async function resolvePermissionIds(client, { permissionIds, permissions }) {
  const allPermsRes = await client.query(`SELECT id, resource, action FROM permissions`);
  const allPerms = allPermsRes.rows;

  if (Array.isArray(permissionIds)) {
    const validIdsSet = new Set(allPerms.map((p) => Number(p.id)));
    const uniqueIds = [...new Set(permissionIds.map(Number))];
    const invalid = uniqueIds.filter((id) => !validIdsSet.has(id));
    if (invalid.length > 0) {
      throw new AppError(
        `IDs de permissão inexistentes: ${invalid.join(', ')}`,
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    return uniqueIds;
  }

  if (Array.isArray(permissions)) {
    const resolved = [];
    for (const item of permissions) {
      if (item.allowed === false) continue;
      const match = allPerms.find(
        (p) => p.resource === item.resource && p.action === item.action,
      );
      if (!match) {
        throw new AppError(
          `Permissão inválida: ${item.resource}:${item.action}`,
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      resolved.push(Number(match.id));
    }
    return [...new Set(resolved)];
  }

  throw new AppError(
    'Informe permissionIds ou permissions para atualizar a matriz.',
    400,
    ErrorCodes.VALIDATION_ERROR,
  );
}

async function updateRolePermissions({
  role,
  permissionIds,
  permissions,
  actorUserId,
  ipAddress,
  userAgent,
}) {
  if (role === 'Admin') {
    throw new AppError(
      'Permissões do perfil Admin são protegidas e não podem ser alteradas.',
      403,
      ErrorCodes.FORBIDDEN,
    );
  }

  if (!EDITABLE_ROLES.includes(role)) {
    throw new AppError(`Perfil inválido: ${role}`, 400, ErrorCodes.VALIDATION_ERROR);
  }

  await withTransaction(async (client) => {
    const oldRes = await client.query(
      `SELECT p.id, p.resource, p.action
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role = $1
       ORDER BY p.id ASC`,
      [role],
    );
    const oldKeys = oldRes.rows.map((r) => `${r.resource}:${r.action}`);

    const targetIds = await resolvePermissionIds(client, { permissionIds, permissions });

    await client.query(`DELETE FROM role_permissions WHERE role = $1`, [role]);

    for (const pid of targetIds) {
      await client.query(
        `INSERT INTO role_permissions (role, permission_id, updated_by)
         VALUES ($1, $2, $3)`,
        [role, pid, actorUserId],
      );
    }

    const newRes = await client.query(
      `SELECT id, resource, action FROM permissions WHERE id = ANY($1::bigint[]) ORDER BY id ASC`,
      [targetIds],
    );
    const newKeys = newRes.rows.map((r) => `${r.resource}:${r.action}`);

    await logAction({
      userId: actorUserId,
      action: 'PERMISSION_CHANGE',
      tableName: 'role_permissions',
      recordId: null,
      oldValue: { role, permissions: oldKeys },
      newValue: { role, permissions: newKeys },
      ipAddress,
      userAgent,
      client,
    });
  });

  invalidateCache(role);
  const updated = await getRolePermissions(role, { bypassCache: true });

  return {
    role,
    permissions: updated,
    permissionIds: updated.map((p) => Number(p.id)),
  };
}

async function getPermissionsAuditLog({
  userId,
  action,
  startDate,
  endDate,
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit || 20)), 100);
  const safePage = Math.max(1, Number(page || 1));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [`(al.action = 'PERMISSION_CHANGE' OR al.table_name = 'role_permissions')`];
  const params = [];

  if (action && action !== 'PERMISSION_CHANGE') {
    params.push(action);
    conditions[0] = `al.action = $${params.length}`;
  }
  if (userId) {
    params.push(Number(userId));
    conditions.push(`al.user_id = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`al.created_at >= $${params.length}::timestamptz`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`al.created_at <= $${params.length}::timestamptz`);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT al.id, al.user_id, u.full_name AS actor_name, u.email AS actor_email, u.role AS actor_role,
              al.action, al.table_name, al.record_id, al.old_value, al.new_value,
              al.ip_address, al.user_agent, al.created_at
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereSql}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, offset],
    ),
    query(`SELECT COUNT(*)::INT AS total FROM audit_log al ${whereSql}`, params),
  ]);

  return {
    items: mapRows(rowsRes.rows),
    total: countRes.rows[0].total,
    page: safePage,
    limit: safeLimit,
  };
}

module.exports = {
  CACHE_TTL_MS,
  VALID_ROLES,
  EDITABLE_ROLES,
  invalidateCache,
  getRolePermissions,
  hasPermission,
  getPermissionsMatrix,
  updateRolePermissions,
  getPermissionsAuditLog,
};
