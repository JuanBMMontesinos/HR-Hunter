const { AppError, ErrorCodes } = require('../utils/errorCodes');

function validate(schema, property = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return next(
        new AppError('Dados de entrada inválidos.', 400, ErrorCodes.VALIDATION_ERROR, details),
      );
    }

    req[property] = value;
    return next();
  };
}

module.exports = validate;
