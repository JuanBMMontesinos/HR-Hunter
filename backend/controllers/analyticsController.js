const securityAnalyticsService = require('../services/securityAnalyticsService');
const { extractRequestMeta } = require('../middleware/auditMiddleware');

async function generateReport(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const data = await securityAnalyticsService.generateSecurityReport({
      periodStart: req.body?.periodStart,
      periodEnd: req.body?.periodEnd,
      actorUserId: Number(req.user.id),
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function listReports(req, res, next) {
  try {
    const data = await securityAnalyticsService.listSecurityReports({
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

async function getReportById(req, res, next) {
  try {
    const data = await securityAnalyticsService.getSecurityReportById(req.params.id);
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
  generateReport,
  listReports,
  getReportById,
};
