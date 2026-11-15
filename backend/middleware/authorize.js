const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { hasPermission } = require('../services/permissionService');
const { recordUnauthorizedAccess } = require('../services/securityAlertService');
const { extractRequestMeta } = require('./auditMiddleware');

function authorize(resource, action) {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Não autenticado.', 401, ErrorCodes.UNAUTHORIZED));
      }

      const allowed = await hasPermission(req.user.role, resource, action);
      if (allowed) {
        return next();
      }

      const { ipAddress, userAgent } = extractRequestMeta(req);
      await recordUnauthorizedAccess({
        userId: Number(req.user.id),
        userEmail: req.user.email,
        resource,
        action,
        endpoint: req.originalUrl,
        ipAddress,
        userAgent,
      });

      return next(
        new AppError(
          `Acesso negado para ${resource}:${action}.`,
          403,
          ErrorCodes.FORBIDDEN,
        ),
      );
    } catch (err) {
      return next(err);
    }
  };
}

async function requireAdmin(req, _res, next) {
  try {
    if (!req.user) {
      return next(new AppError('Não autenticado.', 401, ErrorCodes.UNAUTHORIZED));
    }

    if (req.user.role === 'Admin') {
      return next();
    }

    const { ipAddress, userAgent } = extractRequestMeta(req);
    await recordUnauthorizedAccess({
      userId: Number(req.user.id),
      userEmail: req.user.email,
      resource: 'settings',
      action: req.method.toLowerCase(),
      endpoint: req.originalUrl,
      ipAddress,
      userAgent,
    });

    return next(
      new AppError(
        'Acesso restrito ao perfil Admin.',
        403,
        ErrorCodes.FORBIDDEN,
      ),
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  authorize,
  requireAdmin,
};
