import { test, expect } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  snakeToCamel,
  camelToSnake,
  mapRow,
  mapRows,
  normalizeOptionalString,
} = require('../../backend/utils/dbMapper');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ErrorCodes, AppError } = require('../../backend/utils/errorCodes');

test.describe('Backend Unit — dbMapper & ErrorCodes', () => {
  test('converts snake_case database columns to camelCase DTO keys', () => {
    expect(snakeToCamel('full_name')).toBe('fullName');
    expect(snakeToCamel('is_password_reset_required')).toBe('isPasswordResetRequired');
    expect(snakeToCamel('last_24h')).toBe('last24h');
    expect(camelToSnake('companyId')).toBe('company_id');
  });

  test('maps single row and row arrays cleanly', () => {
    const row = {
      id: 1,
      legal_name: 'TechNova Ltda',
      is_active: true,
      created_at: '2026-11-15T12:00:00Z',
    };

    expect(mapRow(row)).toEqual({
      id: 1,
      legalName: 'TechNova Ltda',
      isActive: true,
      createdAt: '2026-11-15T12:00:00Z',
    });

    expect(mapRows([row])).toHaveLength(1);
    expect(mapRows(null as unknown as [])).toEqual([]);
  });

  test('normalizes empty optional strings (such as optional CPF) and Dates to null or ISO strings', () => {
    expect(normalizeOptionalString('')).toBeNull();
    expect(normalizeOptionalString('   ')).toBeNull();
    expect(normalizeOptionalString(undefined)).toBeNull();
    expect(normalizeOptionalString(' 123.456.789-00 ')).toBe('123.456.789-00');
    expect(normalizeOptionalString(new Date('2026-11-15T12:00:00.000Z'))).toBe('2026-11-15T12:00:00.000Z');
    expect(normalizeOptionalString(new Date('invalid-date'))).toBeNull();
  });

  test('constructs AppError with standardized error codes', () => {
    const err = new AppError('Credenciais inválidas', 401, ErrorCodes.INVALID_CREDENTIALS);
    expect(err.statusCode).toBe(401);
    expect(err.errorCode).toBe('AUTH_001');
    expect(err.message).toBe('Credenciais inválidas');
  });
});
