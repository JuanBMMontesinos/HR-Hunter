const Joi = require('joi');

const GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não responder'];
const STATUSES = ['Ativo', 'Inativo', 'Bloqueado'];
const EDUCATION_LEVELS = ['Técnico', 'Graduação', 'Pós-Graduação', 'Mestrado', 'Doutorado'];
const EDUCATION_STATUSES = ['Cursando', 'Concluído'];
const SKILL_LEVELS = ['Iniciante', 'Intermediário', 'Avançado', 'Especialista'];

const experienceItemSchema = Joi.object({
  company: Joi.string().trim().min(1).max(255).required(),
  position: Joi.string().trim().min(1).max(255).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().allow('', null),
  description: Joi.string().trim().allow('', null),
  skills: Joi.string().trim().allow('', null),
});

const updateExperienceSchema = Joi.object({
  company: Joi.string().trim().min(1).max(255),
  position: Joi.string().trim().min(1).max(255),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().allow('', null),
  description: Joi.string().trim().allow('', null),
  skills: Joi.string().trim().allow('', null),
}).min(1);

const educationItemSchema = Joi.object({
  institution: Joi.string().trim().min(1).max(255).required(),
  course: Joi.string().trim().min(1).max(255).required(),
  level: Joi.string().valid(...EDUCATION_LEVELS).allow('', null),
  yearConclusion: Joi.number().integer().min(1950).max(2100).allow(null),
  status: Joi.string().valid(...EDUCATION_STATUSES).allow('', null),
});

const updateEducationSchema = Joi.object({
  institution: Joi.string().trim().min(1).max(255),
  course: Joi.string().trim().min(1).max(255),
  level: Joi.string().valid(...EDUCATION_LEVELS).allow('', null),
  yearConclusion: Joi.number().integer().min(1950).max(2100).allow(null),
  status: Joi.string().valid(...EDUCATION_STATUSES).allow('', null),
}).min(1);

const skillItemSchema = Joi.object({
  skill: Joi.string().trim().min(1).max(255).required(),
  level: Joi.string().valid(...SKILL_LEVELS).default('Intermediário'),
});

const updateSkillSchema = Joi.object({
  skill: Joi.string().trim().min(1).max(255),
  level: Joi.string().valid(...SKILL_LEVELS),
}).min(1);

const listCandidatesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(150).allow(''),
  name: Joi.string().trim().max(150).allow(''),
  email: Joi.string().trim().max(255).allow(''),
  cpf: Joi.string().trim().max(15).allow(''),
  skill: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid(...STATUSES).allow(''),
});

const candidateBase = {
  fullName: Joi.string().trim().min(2).max(255),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(255),
  phone: Joi.string().trim().max(30).allow('', null),
  cpf: Joi.string().trim().max(15).allow('', null),
  dateBirth: Joi.date().iso().allow('', null),
  gender: Joi.string().valid(...GENDERS).allow('', null),
  street: Joi.string().trim().max(255).allow('', null),
  number: Joi.string().trim().max(20).allow('', null),
  complement: Joi.string().trim().max(255).allow('', null),
  city: Joi.string().trim().max(100).allow('', null),
  state: Joi.string().trim().max(50).allow('', null),
  country: Joi.string().trim().max(100).allow('', null),
  postalCode: Joi.string().trim().max(20).allow('', null),
  linkedin: Joi.string().trim().max(255).allow('', null),
  github: Joi.string().trim().max(255).allow('', null),
  portfolio: Joi.string().trim().max(255).allow('', null),
  cvFilePath: Joi.string().trim().allow('', null),
  desiredPosition: Joi.string().trim().max(255).allow('', null),
  desiredSalary: Joi.number().precision(2).min(0).allow(null),
  availableDate: Joi.date().iso().allow('', null),
  notes: Joi.string().trim().allow('', null),
  status: Joi.string().valid(...STATUSES),
};

const createCandidateSchema = Joi.object({
  ...candidateBase,
  fullName: candidateBase.fullName.required(),
  email: candidateBase.email.required(),
  country: candidateBase.country.default('Brasil'),
  status: candidateBase.status.default('Ativo'),
  experiences: Joi.array().items(experienceItemSchema).optional(),
  experience: Joi.array().items(experienceItemSchema).optional(),
  education: Joi.array().items(educationItemSchema).optional(),
  skills: Joi.array().items(skillItemSchema).optional(),
}).rename('experience', 'experiences', { ignoreUndefined: true, override: false });

const updateCandidateSchema = Joi.object(candidateBase).min(1);

const importCandidatesBodySchema = Joi.object({
  csv: Joi.string().allow('', null),
});

module.exports = {
  listCandidatesQuerySchema,
  createCandidateSchema,
  updateCandidateSchema,
  experienceItemSchema,
  updateExperienceSchema,
  educationItemSchema,
  updateEducationSchema,
  skillItemSchema,
  updateSkillSchema,
  importCandidatesBodySchema,
};
