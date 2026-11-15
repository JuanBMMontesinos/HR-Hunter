const Joi = require('joi');

const dashboardFilterQuerySchema = Joi.object({
  startDate: Joi.date().iso().allow('', null),
  endDate: Joi.date().iso().allow('', null),
  companyId: Joi.number().integer().positive().allow('', null),
  department: Joi.string().trim().max(100).allow('', null),
  jobOpeningId: Joi.number().integer().positive().allow('', null),
});

const updateSettingsSchema = Joi.alternatives().try(
  Joi.object({
    configs: Joi.array()
      .items(
        Joi.object({
          configKey: Joi.string().trim().min(1).max(255).required(),
          configValue: Joi.alternatives().try(Joi.string().allow(''), Joi.number(), Joi.boolean()).allow(null).required(),
          dataType: Joi.string().valid('string', 'int', 'boolean', 'json').optional(),
          category: Joi.string().trim().max(100).optional(),
          isSensitive: Joi.boolean().optional(),
        }),
      )
      .min(1)
      .required(),
  }),
  Joi.object().pattern(
    Joi.string().trim().min(1).max(255),
    Joi.alternatives().try(Joi.string().allow(''), Joi.number(), Joi.boolean(), Joi.allow(null)),
  ).min(1),
);

const stageSchema = Joi.object({
  stageName: Joi.string().trim().min(2).max(255).required(),
  stageOrder: Joi.number().integer().min(1).required(),
  isActive: Joi.boolean().default(true),
  requiresFeedback: Joi.boolean().default(true),
  isTerminal: Joi.boolean().default(false),
  description: Joi.string().trim().allow('', null),
});

const updateStageSchema = Joi.object({
  stageName: Joi.string().trim().min(2).max(255),
  stageOrder: Joi.number().integer().min(1),
  isActive: Joi.boolean(),
  requiresFeedback: Joi.boolean(),
  isTerminal: Joi.boolean(),
  description: Joi.string().trim().allow('', null),
}).min(1);

const funnelItemSchema = Joi.object({
  stageId: Joi.number().integer().positive().required(),
  stageOrder: Joi.number().integer().min(1).required(),
});

const funnelSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(500).allow('', null),
  isActive: Joi.boolean().default(true),
  isDefault: Joi.boolean().default(false),
  stageIds: Joi.array().items(Joi.number().integer().positive()).optional(),
  items: Joi.array().items(funnelItemSchema).optional(),
});

const updateFunnelSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().max(500).allow('', null),
  isActive: Joi.boolean(),
  isDefault: Joi.boolean(),
  stageIds: Joi.array().items(Joi.number().integer().positive()).optional(),
  items: Joi.array().items(funnelItemSchema).optional(),
}).min(1);

const emailTemplateSchema = Joi.object({
  templateKey: Joi.string().trim().min(2).max(100).pattern(/^[a-z0-9_]+$/).required(),
  name: Joi.string().trim().min(2).max(255).required(),
  subject: Joi.string().trim().min(2).max(500).required(),
  bodyHtml: Joi.string().trim().min(1).required(),
  variables: Joi.array().items(Joi.string().trim().max(100)).default([]),
  language: Joi.string().valid('pt-BR', 'en-US').default('pt-BR'),
  isActive: Joi.boolean().default(true),
});

const updateEmailTemplateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255),
  subject: Joi.string().trim().min(2).max(500),
  bodyHtml: Joi.string().trim().min(1),
  variables: Joi.array().items(Joi.string().trim().max(100)),
  language: Joi.string().valid('pt-BR', 'en-US'),
  isActive: Joi.boolean(),
}).min(1);

const emailTestSchema = Joi.object({
  to: Joi.string().trim().email({ tlds: { allow: false } }).required(),
  templateKey: Joi.string().trim().max(100).allow('', null),
  variables: Joi.object().default({}),
});

const auditLogQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.number().integer().positive().allow(''),
  action: Joi.string().trim().max(50).allow(''),
  tableName: Joi.string().trim().max(100).allow(''),
  startDate: Joi.date().iso().allow(''),
  endDate: Joi.date().iso().allow(''),
});

const loginHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.number().integer().positive().allow(''),
  isSuccessful: Joi.boolean().truthy('true', '1').falsy('false', '0').allow(''),
  email: Joi.string().trim().max(255).allow(''),
  startDate: Joi.date().iso().allow(''),
  endDate: Joi.date().iso().allow(''),
});

const backupSchema = Joi.object({
  format: Joi.string().valid('json', 'sql').default('json'),
  download: Joi.boolean().default(false),
});

module.exports = {
  dashboardFilterQuerySchema,
  updateSettingsSchema,
  stageSchema,
  updateStageSchema,
  funnelSchema,
  updateFunnelSchema,
  emailTemplateSchema,
  updateEmailTemplateSchema,
  emailTestSchema,
  auditLogQuerySchema,
  loginHistoryQuerySchema,
  backupSchema,
};
