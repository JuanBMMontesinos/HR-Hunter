const Joi = require('joi');

const ROLES = ['Admin', 'Gerente', 'Recrutador', 'Consultor', 'GestorRH'];
const LANGUAGES = ['pt-BR', 'en-US'];

const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid(...ROLES).allow(''),
  department: Joi.string().trim().max(100).allow(''),
  isActive: Joi.boolean().truthy('true', '1', 'Ativo').falsy('false', '0', 'Inativo').allow(''),
  status: Joi.string().valid('Ativo', 'Inativo', 'active', 'inactive').allow(''),
  search: Joi.string().trim().max(150).allow(''),
});

const createUserSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  fullName: Joi.string().trim().min(2).max(255).required(),
  phone: Joi.string().trim().max(30).allow('', null),
  role: Joi.string().valid(...ROLES).required(),
  department: Joi.string().trim().max(100).allow('', null),
  managerId: Joi.number().integer().positive().allow(null),
  isActive: Joi.boolean().default(true),
  hiringDate: Joi.date().iso().allow('', null),
  preferredLanguage: Joi.string().valid(...LANGUAGES).default('pt-BR'),
  isPasswordResetRequired: Joi.boolean().default(false),
});

const updateUserSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(255),
  fullName: Joi.string().trim().min(2).max(255),
  phone: Joi.string().trim().max(30).allow('', null),
  role: Joi.string().valid(...ROLES),
  department: Joi.string().trim().max(100).allow('', null),
  managerId: Joi.number().integer().positive().allow(null),
  isActive: Joi.boolean(),
  hiringDate: Joi.date().iso().allow('', null),
  preferredLanguage: Joi.string().valid(...LANGUAGES),
  isPasswordResetRequired: Joi.boolean(),
}).min(1);

const adminResetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).max(128).optional(),
  requireResetOnLogin: Joi.boolean().default(true),
  sendEmail: Joi.boolean().default(false),
});

module.exports = {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  adminResetPasswordSchema,
};
