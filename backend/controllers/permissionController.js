const permissionService = require('../services/permissionService');
const { extractRequestMeta } = require('../middleware/auditMiddleware');

async function getMatrix(_req, res, next) {
  try {
    const data = await permissionService.getPermissionsMatrix();
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function updateRolePermissions(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const data = await permissionService.updateRolePermissions({
      role: req.params.role,
      permissionIds: req.body.permissionIds,
      permissions: req.body.permissions,
      actorUserId: Number(req.user.id),
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function getAuditLog(req, res, next) {
  try {
    const data = await permissionService.getPermissionsAuditLog({
      userId: req.query.userId,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit,
    });

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMatrix,
  updateRolePermissions,
  getAuditLog,
};
