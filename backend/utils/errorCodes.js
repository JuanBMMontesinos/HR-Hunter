const ErrorCodes = {
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  UNAUTHORIZED: 'AUTH_003',
  ACCOUNT_LOCKED: 'AUTH_004',
  FORBIDDEN: 'AUTH_005',

  VALIDATION_ERROR: 'VAL_001',
  EMAIL_ALREADY_EXISTS: 'VAL_002',
  DUPLICATE_DOCUMENT: 'VAL_003',

  RESOURCE_NOT_FOUND: 'RES_001',
  RESOURCE_CONFLICT: 'RES_002',

  INTERNAL_ERROR: 'SRV_001',
  DATABASE_ERROR: 'SRV_002',
};

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = ErrorCodes.INTERNAL_ERROR, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

module.exports = {
  ErrorCodes,
  AppError,
};
