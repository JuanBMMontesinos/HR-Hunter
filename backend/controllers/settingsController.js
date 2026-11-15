const settingsService = require('../services/settingsService');
const { parsePositiveInt } = require('../utils/queryHelpers');
const { sendSuccess, actorMeta } = require('../utils/responseHelper');

async function getSettings(_req, res, next) {
  try {
    const data = await settingsService.getSettings();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await settingsService.updateSettings(req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function listStages(_req, res, next) {
  try {
    const data = await settingsService.listStages();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function createStage(req, res, next) {
  try {
    const data = await settingsService.createStage(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function updateStage(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da etapa');
    const data = await settingsService.updateStage(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function deleteStage(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da etapa');
    const data = await settingsService.deleteStage(id, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function listFunnels(_req, res, next) {
  try {
    const data = await settingsService.listFunnels();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function createFunnel(req, res, next) {
  try {
    const data = await settingsService.createFunnel(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function updateFunnel(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do funil');
    const data = await settingsService.updateFunnel(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function deleteFunnel(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do funil');
    const data = await settingsService.deleteFunnel(id, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function listEmailTemplates(_req, res, next) {
  try {
    const data = await settingsService.listEmailTemplates();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function createEmailTemplate(req, res, next) {
  try {
    const data = await settingsService.createEmailTemplate(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function updateEmailTemplate(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do template');
    const data = await settingsService.updateEmailTemplate(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function deleteEmailTemplate(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do template');
    const data = await settingsService.deleteEmailTemplate(id, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function sendTestEmail(req, res, next) {
  try {
    const data = await settingsService.sendTestEmail(req.body);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function listAuditLog(req, res, next) {
  try {
    const data = await settingsService.listAuditLog(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function listLoginHistory(req, res, next) {
  try {
    const data = await settingsService.listLoginHistory(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function backup(req, res, next) {
  try {
    const { format = 'json', download = false } = req.body || {};
    const snapshot = await settingsService.generateBackupSnapshot({ format }, actorMeta(req));

    if (download) {
      const dateSlug = new Date().toISOString().slice(0, 10);
      if (format === 'sql') {
        res.setHeader('Content-Type', 'application/sql; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="hr-hunter-snapshot-${dateSlug}.sql"`);
        return res.status(200).send(snapshot.sqlContent);
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="hr-hunter-snapshot-${dateSlug}.json"`);
      return res.status(200).send(JSON.stringify(snapshot, null, 2));
    }

    return sendSuccess(res, snapshot);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
  listStages,
  createStage,
  updateStage,
  deleteStage,
  listFunnels,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  sendTestEmail,
  listAuditLog,
  listLoginHistory,
  backup,
};
