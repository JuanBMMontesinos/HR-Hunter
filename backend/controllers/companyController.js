const companyService = require('../services/companyService');
const { parsePositiveInt } = require('../utils/queryHelpers');
const { sendSuccess, actorMeta } = require('../utils/responseHelper');

async function list(req, res, next) {
  try {
    const data = await companyService.listCompanies(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da empresa');
    const data = await companyService.getCompanyById(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await companyService.createCompany(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da empresa');
    const data = await companyService.updateCompany(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID da empresa');
    const data = await companyService.softDeleteCompany(id, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
