const { logAction } = require('../services/auditService');

function extractRequestMeta(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = req.get('user-agent') || null;
  return { ipAddress, userAgent };
}

function auditMiddleware(action, tableName, options = {}) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const { ipAddress, userAgent } = extractRequestMeta(req);
      const recordId = options.getRecordId ? options.getRecordId(req, res) : Number(req.params.id) || null;
      const newValue = options.getNewValue ? options.getNewValue(req, res) : req.body || null;
      const oldValue = res.locals.auditOldValue || null;

      void logAction({
        userId: req.user?.id || null,
        action,
        tableName,
        recordId,
        oldValue,
        newValue,
        ipAddress,
        userAgent,
      });
    });
    next();
  };
}

module.exports = {
  extractRequestMeta,
  auditMiddleware,
};
