export interface PasswordStrengthResult {
  valid: boolean;
  score: number;
  maxScore: number;
  minLength: number;
  rules: {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export const PASSWORD_PATTERN_HTML = '(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}';

export function evaluatePasswordStrength(
  password: string,
  minLength = 8,
): PasswordStrengthResult {
  const effectiveMin = Math.max(8, Number(minLength) || 8);
  const value = typeof password === 'string' ? password : '';

  const rules = {
    minLength: value.length >= effectiveMin,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };

  const score = Object.values(rules).filter(Boolean).length;

  return {
    valid: score === 5,
    score,
    maxScore: 5,
    minLength: effectiveMin,
    rules,
  };
}
