const retentionService = require('../services/retentionService');
const { extractRequestMeta } = require('../middleware/auditMiddleware');

async function listPolicies(_req, res, next) {
  try {
    const items = await retentionService.listPolicies();
    res.status(200).json({
      success: true,
      data: { items },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function updatePolicy(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const data = await retentionService.updatePolicy({
      key: req.params.key,
      days: req.body.days,
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

async function executeRetention(req, res, next) {
  try {
    const { ipAddress, userAgent } = extractRequestMeta(req);
    const data = await retentionService.executeRetention({
      dryRun: Boolean(req.body?.dryRun),
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

async function getHistory(req, res, next) {
  try {
    const data = await retentionService.getRetentionHistory({
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
  listPolicies,
  updatePolicy,
  executeRetention,
  getHistory,
};
