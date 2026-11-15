import { test, expect } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validatePasswordStrength } = require('../../backend/utils/passwordPolicy');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizer = require('../../backend/utils/sanitizer');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokenUtils = require('../../backend/utils/tokenUtils');

test.describe('Backend Unit — Auth Policy, Tokens & Sanitizer', () => {
  test('validatePasswordStrength enforces length, case, digit, and special character rules', () => {
    const weak = validatePasswordStrength('abc');
    expect(weak.valid).toBe(false);
    expect(weak.errors.length).toBeGreaterThanOrEqual(4);

    const noSpecial = validatePasswordStrength('Abcdef12');
    expect(noSpecial.valid).toBe(false);

    const shortCustom = validatePasswordStrength('Ab1!5678', { minLength: 10 });
    expect(shortCustom.valid).toBe(false);

    const strong = validatePasswordStrength('HrHunter@2026!');
    expect(strong.valid).toBe(true);
    expect(strong.errors).toEqual([]);
  });

  test('tokenUtils signs/verifies JWT and hashes opaque tokens deterministically', () => {
    const token = tokenUtils.signAccessToken({
      id: 42,
      email: 'recruiter@hrhunter.com',
      role: 'Recrutador',
    });

    const decoded = tokenUtils.verifyAccessToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.email).toBe('recruiter@hrhunter.com');
    expect(decoded.role).toBe('Recrutador');
    expect(decoded.iss).toBe('hr-hunter-api');

    const rawA = tokenUtils.generateOpaqueToken(32);
    const rawB = tokenUtils.generateOpaqueToken(32);
    expect(rawA).toHaveLength(64);
    expect(rawA).not.toBe(rawB);
    expect(tokenUtils.hashToken(rawA)).toHaveLength(64);
    expect(tokenUtils.hashToken(rawA)).toBe(tokenUtils.hashToken(rawA));

    expect(tokenUtils.parseDurationToMs('15m')).toBe(15 * 60 * 1000);
    expect(tokenUtils.parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);

    const cookieOpts = tokenUtils.getRefreshCookieOptions(60_000);
    expect(cookieOpts.httpOnly).toBe(true);
    expect(cookieOpts.sameSite).toBe('lax');
    expect(cookieOpts.path).toBe('/api/v1/auth');
    expect(cookieOpts.maxAge).toBe(60_000);
    expect(typeof cookieOpts.secure).toBe('boolean');
  });

  test('sanitizer strips XSS vectors and shields CSV cells from formula injection', () => {
    const cleanHtml = sanitizer.sanitizeHtml(
      '<p onclick="alert(1)">Olá</p><script>steal()</script><a href="javascript:void(0)">Link</a>',
    );
    expect(cleanHtml).not.toContain('<script>');
    expect(cleanHtml).not.toContain('onclick');
    expect(cleanHtml).not.toContain('javascript:');
    expect(cleanHtml).toContain('<p>Olá</p>');

    expect(sanitizer.stripHtmlTags('<p>Texto <strong>limpo</strong></p>')).toBe('Texto limpo');

    expect(sanitizer.escapeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizer.escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(sanitizer.escapeCsvCell('valor;com;ponto')).toBe('"valor;com;ponto"');
  });
});
