const userService = require('../services/userService');
const { parsePositiveInt } = require('../utils/queryHelpers');
const { sendSuccess, actorMeta } = require('../utils/responseHelper');

async function list(req, res, next) {
  try {
    const data = await userService.listUsers(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do usuário');
    const data = await userService.getUserById(id, req.user, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await userService.createUser(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do usuário');
    const data = await userService.updateUser(id, req.body, req.user, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do usuário');
    const data = await userService.softDeleteUser(id, req.user, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function activity(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do usuário');
    const data = await userService.getUserActivity(id, req.user, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do usuário');
    const data = await userService.adminResetPassword(id, req.body, actorMeta(req));
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
  activity,
  resetPassword,
};
