const { extractRequestMeta } = require('../middleware/auditMiddleware');

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

function actorMeta(req) {
  const { ipAddress, userAgent } = extractRequestMeta(req);
  return {
    actorUserId: req.user ? Number(req.user.id) : null,
    ipAddress,
    userAgent,
    endpoint: req.originalUrl,
  };
}

module.exports = {
  sendSuccess,
  actorMeta,
};
