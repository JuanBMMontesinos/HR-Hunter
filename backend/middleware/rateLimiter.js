const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Muitas requisições. Tente novamente em instantes.',
    },
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `${req.ip}:${email || 'anonymous'}`;
  },
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Muitas tentativas de login. Tente novamente após 15 minutos.',
    },
  },
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.exportRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Limite de exportações por hora atingido. Tente novamente mais tarde.',
    },
  },
});

module.exports = {
  apiLimiter,
  loginLimiter,
  exportLimiter,
};
