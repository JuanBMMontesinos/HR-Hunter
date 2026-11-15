/**
 * Validates password complexity rules aligned with HR Hunter security configurations.
 */
function validatePasswordStrength(password, options = {}) {
  const minLength = Math.max(8, Number(options.minLength || 8));
  const value = typeof password === 'string' ? password : '';
  const errors = [];

  if (value.length < minLength) {
    errors.push(`A senha deve ter no mínimo ${minLength} caracteres.`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('A senha deve conter ao menos uma letra maiúscula.');
  }
  if (!/[a-z]/.test(value)) {
    errors.push('A senha deve conter ao menos uma letra minúscula.');
  }
  if (!/[0-9]/.test(value)) {
    errors.push('A senha deve conter ao menos um número.');
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push('A senha deve conter ao menos um caractere especial.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validatePasswordStrength,
};
