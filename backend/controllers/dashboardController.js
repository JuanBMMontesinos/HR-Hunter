const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/responseHelper');

async function kpis(req, res, next) {
  try {
    const data = await dashboardService.getDashboardKpis(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function analytics(req, res, next) {
  try {
    const data = await dashboardService.getDashboardAnalytics(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function criticalProcesses(req, res, next) {
  try {
    const data = await dashboardService.getCriticalProcesses(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  kpis,
  analytics,
  criticalProcesses,
};
