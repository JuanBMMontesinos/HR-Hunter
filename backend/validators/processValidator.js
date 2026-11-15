const Joi = require('joi');

const PROCESS_STATUSES = ['Em Andamento', 'Parado', 'Concluído'];
const RECOMMENDATIONS = ['Avançar', 'Rejeitar', 'Em Dúvida'];
const OFFER_STATUSES = ['Enviada', 'Visualizada', 'Aceita', 'Recusada'];

const listProcessesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  jobOpeningId: Joi.number().integer().positive().allow(''),
  candidateId: Joi.number().integer().positive().allow(''),
  companyId: Joi.number().integer().positive().allow(''),
  stageId: Joi.number().integer().positive().allow(''),
  status: Joi.string().valid(...PROCESS_STATUSES).allow(''),
  search: Joi.string().trim().max(150).allow(''),
});

const kanbanQuerySchema = Joi.object({
  jobOpeningId: Joi.number().integer().positive().allow(''),
  companyId: Joi.number().integer().positive().allow(''),
  funnelId: Joi.number().integer().positive().allow(''),
  status: Joi.string().valid(...PROCESS_STATUSES).allow(''),
  search: Joi.string().trim().max(150).allow(''),
});

const createProcessSchema = Joi.object({
  jobOpeningId: Joi.number().integer().positive().required(),
  candidateId: Joi.number().integer().positive().required(),
  stageId: Joi.number().integer().positive().allow(null),
  feedback: Joi.string().trim().allow('', null),
  responsibleUserId: Joi.number().integer().positive().allow(null),
});

const updateProcessSchema = Joi.object({
  status: Joi.string().valid(...PROCESS_STATUSES),
  currentStageId: Joi.number().integer().positive(),
  endDate: Joi.date().iso().allow(null),
}).min(1);

const nextStageSchema = Joi.object({
  nextStageId: Joi.number().integer().positive().allow(null),
  stageId: Joi.number().integer().positive().allow(null),
  feedback: Joi.string().trim().allow('', null),
  rating: Joi.number().integer().min(1).max(5).allow(null),
  strengths: Joi.string().trim().allow('', null),
  weaknesses: Joi.string().trim().allow('', null),
  recommendation: Joi.string().valid(...RECOMMENDATIONS).allow('', null),
  scheduledAt: Joi.date().iso().allow('', null),
  attachedDocuments: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.object())).default([]),
}).rename('stageId', 'nextStageId', { ignoreUndefined: true, override: false });

const rejectProcessSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000),
  feedback: Joi.string().trim().min(3).max(2000),
  rating: Joi.number().integer().min(1).max(5).allow(null),
  sendEmail: Joi.boolean().default(false),
})
  .rename('feedback', 'reason', { ignoreUndefined: true, override: false })
  .or('reason');

const offerProcessSchema = Joi.object({
  position: Joi.string().trim().min(2).max(255).allow('', null),
  salary: Joi.number().precision(2).min(0).allow(null),
  benefits: Joi.string().trim().allow('', null),
  startDate: Joi.date().iso().allow('', null),
  conditions: Joi.string().trim().allow('', null),
  sendEmail: Joi.boolean().default(false),
});

const updateOfferSchema = Joi.object({
  status: Joi.string().valid(...OFFER_STATUSES).required(),
  advanceToHired: Joi.boolean().default(true),
});

module.exports = {
  listProcessesQuerySchema,
  kanbanQuerySchema,
  createProcessSchema,
  updateProcessSchema,
  nextStageSchema,
  rejectProcessSchema,
  offerProcessSchema,
  updateOfferSchema,
};
