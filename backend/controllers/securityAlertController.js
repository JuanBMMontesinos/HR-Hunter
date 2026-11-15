const securityAlertService = require('../services/securityAlertService');
const { extractRequestMeta } = require('../middleware/auditMiddleware');

async function listAlerts(req, res, next) {
  try {
    const data = await securityAlertService.listAlerts({
      status: req.query.status,
      severity: req.query.severity,
      alertType: req.query.alertType,
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

async function getStats(_req, res, next) {
  try {
    const data = await securityAlertService.getSecurityStats();
    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function resolveAlert(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const data = await securityAlertService.resolveAlert({
      alertId: Number(req.params.id),
      status: req.body.status,
      resolutionNote: req.body.resolutionNote,
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

module.exports = {
  listAlerts,
  getStats,
  resolveAlert,
};
