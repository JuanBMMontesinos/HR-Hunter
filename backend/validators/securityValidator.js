const Joi = require('joi');

const updateRolePermissionsSchema = Joi.object({
  permissionIds: Joi.array().items(Joi.number().integer().positive()),
  permissions: Joi.array().items(
    Joi.object({
      resource: Joi.string().trim().required(),
      action: Joi.string().trim().required(),
      allowed: Joi.boolean().default(true),
    }),
  ),
}).or('permissionIds', 'permissions');

const resolveAlertSchema = Joi.object({
  status: Joi.string().valid('RESOLVED', 'DISMISSED').default('RESOLVED'),
  resolutionNote: Joi.string().trim().max(500).allow('', null),
});

const generateReportSchema = Joi.object({
  periodStart: Joi.date().iso().optional(),
  periodEnd: Joi.date().iso().optional(),
});

const updateRetentionPolicySchema = Joi.object({
  days: Joi.number().integer().min(1).max(3650).required(),
});

const executeRetentionSchema = Joi.object({
  dryRun: Joi.boolean().default(false),
});

module.exports = {
  updateRolePermissionsSchema,
  resolveAlertSchema,
  generateReportSchema,
  updateRetentionPolicySchema,
  executeRetentionSchema,
};
