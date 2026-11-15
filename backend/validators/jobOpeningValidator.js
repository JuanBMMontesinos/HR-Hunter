const Joi = require('joi');

const LEVELS = ['Estagiário', 'Júnior', 'Pleno', 'Sênior', 'Especialista'];
const CONTRACT_TYPES = ['CLT', 'PJ', 'Temporário', 'Estágio'];
const REGIMES = ['Presencial', 'Híbrido', 'Remoto'];
const STATUSES = ['Aberta', 'Em Progresso', 'Preenchida', 'Cancelada'];
const PRIORITIES = ['Alta', 'Média', 'Baixa'];

const listJobOpeningsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  companyId: Joi.number().integer().positive().allow(''),
  status: Joi.string().valid(...STATUSES).allow(''),
  level: Joi.string().valid(...LEVELS).allow(''),
  department: Joi.string().trim().max(100).allow(''),
  contractType: Joi.string().valid(...CONTRACT_TYPES).allow(''),
  regime: Joi.string().valid(...REGIMES).allow(''),
  priority: Joi.string().valid(...PRIORITIES).allow(''),
  responsibleUserId: Joi.number().integer().positive().allow(''),
  search: Joi.string().trim().max(150).allow(''),
});

const jobOpeningBase = {
  companyId: Joi.number().integer().positive(),
  funnelId: Joi.number().integer().positive().allow(null),
  title: Joi.string().trim().min(2).max(255),
  description: Joi.string().trim().allow('', null),
  department: Joi.string().trim().max(100).allow('', null),
  level: Joi.string().valid(...LEVELS).allow('', null),
  contractType: Joi.string().valid(...CONTRACT_TYPES).allow('', null),
  regime: Joi.string().valid(...REGIMES).allow('', null),
  minSalary: Joi.number().precision(2).min(0).allow(null),
  maxSalary: Joi.number().precision(2).min(0).allow(null),
  salaryMin: Joi.number().precision(2).min(0).allow(null),
  salaryMax: Joi.number().precision(2).min(0).allow(null),
  quantityNeeded: Joi.number().integer().min(1),
  requiredSkills: Joi.string().trim().allow('', null),
  desiredSkills: Joi.string().trim().allow('', null),
  benefits: Joi.string().trim().allow('', null),
  openedAt: Joi.date().iso().allow('', null),
  plannedClosedAt: Joi.date().iso().allow('', null),
  closedAt: Joi.date().iso().allow('', null),
  closedReason: Joi.string().trim().allow('', null),
  responsibleUserId: Joi.number().integer().positive().allow(null),
  status: Joi.string().valid(...STATUSES),
  priority: Joi.string().valid(...PRIORITIES),
};

function withSalaryNormalization(schema) {
  return schema
    .rename('salaryMin', 'minSalary', { ignoreUndefined: true, override: false })
    .rename('salaryMax', 'maxSalary', { ignoreUndefined: true, override: false })
    .custom((value, helpers) => {
      if (
        value.minSalary !== null &&
        value.minSalary !== undefined &&
        value.maxSalary !== null &&
        value.maxSalary !== undefined &&
        Number(value.maxSalary) < Number(value.minSalary)
      ) {
        return helpers.message('maxSalary deve ser maior ou igual a minSalary.');
      }
      return value;
    });
}

const createJobOpeningSchema = withSalaryNormalization(
  Joi.object({
    ...jobOpeningBase,
    companyId: jobOpeningBase.companyId.required(),
    title: jobOpeningBase.title.required(),
    quantityNeeded: jobOpeningBase.quantityNeeded.default(1),
    status: jobOpeningBase.status.default('Aberta'),
    priority: jobOpeningBase.priority.default('Média'),
  }),
);

const updateJobOpeningSchema = withSalaryNormalization(Joi.object(jobOpeningBase).min(1));

module.exports = {
  listJobOpeningsQuerySchema,
  createJobOpeningSchema,
  updateJobOpeningSchema,
};
