const candidateService = require('../services/candidateService');
const { AppError, ErrorCodes } = require('../utils/errorCodes');
const { parsePositiveInt } = require('../utils/queryHelpers');
const { sendSuccess, actorMeta } = require('../utils/responseHelper');

async function list(req, res, next) {
  try {
    const data = await candidateService.listCandidates(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do candidato');
    const data = await candidateService.getCandidateById(id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await candidateService.createCandidate(req.body, actorMeta(req));
    return sendSuccess(res, data, 201);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do candidato');
    const data = await candidateService.updateCandidate(id, req.body, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'ID do candidato');
    const data = await candidateService.softDeleteCandidate(id, actorMeta(req));
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function importCsv(req, res, next) {
  try {
    const csvText = req.file ? req.file.buffer.toString('utf8') : req.body?.csv;
    if (!csvText || String(csvText).trim().length === 0) {
      throw new AppError(
        'Envie um arquivo CSV (campo file) ou conteúdo no campo csv.',
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    const data = await candidateService.importCandidatesFromCsv(csvText, actorMeta(req));
    return sendSuccess(res, data, 200);
  } catch (err) {
    return next(err);
  }
}

function makeSubResourceController(type, itemParamName) {
  return {
    list: async (req, res, next) => {
      try {
        const candidateId = parsePositiveInt(req.params.id, 'ID do candidato');
        const data = await candidateService.listSubResource(candidateId, type);
        return sendSuccess(res, data);
      } catch (err) {
        return next(err);
      }
    },
    add: async (req, res, next) => {
      try {
        const candidateId = parsePositiveInt(req.params.id, 'ID do candidato');
        const data = await candidateService.addSubResource(candidateId, type, req.body, actorMeta(req));
        return sendSuccess(res, data, 201);
      } catch (err) {
        return next(err);
      }
    },
    update: async (req, res, next) => {
      try {
        const candidateId = parsePositiveInt(req.params.id, 'ID do candidato');
        const itemId = parsePositiveInt(req.params[itemParamName], `ID do item (${type})`);
        const data = await candidateService.updateSubResource(
          candidateId,
          type,
          itemId,
          req.body,
          actorMeta(req),
        );
        return sendSuccess(res, data);
      } catch (err) {
        return next(err);
      }
    },
    remove: async (req, res, next) => {
      try {
        const candidateId = parsePositiveInt(req.params.id, 'ID do candidato');
        const itemId = parsePositiveInt(req.params[itemParamName], `ID do item (${type})`);
        const data = await candidateService.deleteSubResource(candidateId, type, itemId, actorMeta(req));
        return sendSuccess(res, data);
      } catch (err) {
        return next(err);
      }
    },
  };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  importCsv,
  experience: makeSubResourceController('experience', 'expId'),
  education: makeSubResourceController('education', 'eduId'),
  skills: makeSubResourceController('skills', 'skillId'),
};
