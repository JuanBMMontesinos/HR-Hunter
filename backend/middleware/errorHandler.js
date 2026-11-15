const { ErrorCodes } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const env = require('../config/env');

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.errorCode || ErrorCodes.INTERNAL_ERROR;

  if (statusCode >= 500) {
    logger.error('Unhandled API error', {
      path: req.originalUrl,
      method: req.method,
      code,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'Erro interno do servidor',
      ...(err.details ? { details: err.details } : {}),
      ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
