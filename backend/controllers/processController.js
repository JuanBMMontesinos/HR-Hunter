const processService = require('../services/processService');
const { parsePositiveInt } = require('../utils/queryHelpers');
const { sendSuccess, actorMeta } = require('../utils/responseHelper');

async function list(req, res, next) {
  try {
    const data = await processService.listProcesses(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function kanban(req, res, next) {
  try {
    const data = await processService.getKanbanBoard(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const data = await processService.getProcessById(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await processService.createProcess(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const data = await processService.updateProcess(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function nextStage(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const data = await processService.advanceToNextStage(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function reject(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const data = await processService.rejectProcess(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function offer(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const data = await processService.createOfferForProcess(id, req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function updateOffer(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const offerId = parsePositiveInt(req.params.offerId, 'ID da proposta');
    const data = await processService.updateOfferStatus(id, offerId, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function timeline(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do processo');
    const data = await processService.getProcessTimeline(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  kanban,
  getById,
  create,
  update,
  nextStage,
  reject,
  offer,
  updateOffer,
  timeline,
};
