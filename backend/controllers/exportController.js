const exportService = require('../services/exportService');
const { extractRequestMeta } = require('../middleware/auditMiddleware');

async function exportUnauthorizedLogsCsv(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const csv = await exportService.exportUnauthorizedLogsCsv({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      actorUserId: Number(req.user.id),
      ipAddress,
      userAgent,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="unauthorized-access-logs.csv"');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

async function exportUnauthorizedLogsPdf(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const pdfBuffer = await exportService.exportUnauthorizedLogsPdf({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      actorUserId: Number(req.user.id),
      ipAddress,
      userAgent,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="unauthorized-access-logs.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

async function exportSecurityAlertsCsv(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const csv = await exportService.exportSecurityAlertsCsv({
      status: req.query.status,
      severity: req.query.severity,
      actorUserId: Number(req.user.id),
      ipAddress,
      userAgent,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="security-alerts.csv"');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportUnauthorizedLogsCsv,
  exportUnauthorizedLogsPdf,
  exportSecurityAlertsCsv,
};
