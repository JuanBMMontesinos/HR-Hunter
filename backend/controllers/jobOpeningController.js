const jobOpeningService = require('../services/jobOpeningService');
const { parsePositiveInt } = require('../utils/queryHelpers');
const { sendSuccess, actorMeta } = require('../utils/responseHelper');

async function list(req, res, next) {
  try {
    const data = await jobOpeningService.listJobOpenings(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da vaga');
    const data = await jobOpeningService.getJobOpeningById(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getCandidates(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da vaga');
    const data = await jobOpeningService.getJobOpeningCandidates(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da vaga');
    const data = await jobOpeningService.getJobOpeningAnalytics(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await jobOpeningService.createJobOpening(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da vaga');
    const data = await jobOpeningService.updateJobOpening(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da vaga');
    const data = await jobOpeningService.deleteJobOpening(id, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  getById,
  getCandidates,
  getAnalytics,
  create,
  update,
  remove,
};
