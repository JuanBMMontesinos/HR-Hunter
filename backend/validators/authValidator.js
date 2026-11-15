const Joi = require('joi');

const emailRule = Joi.string()
  .trim()
  .email({ tlds: { allow: false } })
  .max(255)
  .required();

const loginSchema = Joi.object({
  email: emailRule,
  password: Joi.string().min(1).max(255).required(),
});

const forgotPasswordSchema = Joi.object({
  email: emailRule,
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().min(16).max(512).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

module.exports = {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
