const Joi = require('joi');

const listCompaniesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(20).default(20),
  search: Joi.string().trim().max(150).allow(''),
  name: Joi.string().trim().max(150).allow(''),
  status: Joi.string().valid('Ativo', 'Inativo').allow(''),
  sector: Joi.string().trim().max(100).allow(''),
  cnpj: Joi.string().trim().max(20).allow(''),
});

const companyFields = {
  legalName: Joi.string().trim().min(2).max(255),
  tradeName: Joi.string().trim().max(255).allow('', null),
  cnpj: Joi.string().trim().min(11).max(20),
  sector: Joi.string().trim().max(100).allow('', null),
  street: Joi.string().trim().max(255).allow('', null),
  number: Joi.string().trim().max(20).allow('', null),
  complement: Joi.string().trim().max(255).allow('', null),
  city: Joi.string().trim().max(100).allow('', null),
  state: Joi.string().trim().max(50).allow('', null),
  country: Joi.string().trim().max(100).allow('', null),
  postalCode: Joi.string().trim().max(20).allow('', null),
  phone: Joi.string().trim().max(30).allow('', null),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(255).allow('', null),
  website: Joi.string().trim().max(255).allow('', null),
  contactName: Joi.string().trim().max(255).allow('', null),
  contactEmail: Joi.string().trim().email({ tlds: { allow: false } }).max(255).allow('', null),
  contactPhone: Joi.string().trim().max(30).allow('', null),
  notes: Joi.string().trim().allow('', null),
  status: Joi.string().valid('Ativo', 'Inativo'),
};

const createCompanySchema = Joi.object({
  ...companyFields,
  legalName: companyFields.legalName.required(),
  cnpj: companyFields.cnpj.required(),
  country: companyFields.country.default('Brasil'),
  status: companyFields.status.default('Ativo'),
});

const updateCompanySchema = Joi.object(companyFields).min(1);

module.exports = {
  listCompaniesQuerySchema,
  createCompanySchema,
  updateCompanySchema,
};
