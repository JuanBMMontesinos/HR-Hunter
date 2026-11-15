import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashToken } = require('../../backend/utils/tokenUtils');

test.describe('API Integration — Auth, Lockout, Refresh Rotation & Password Reset', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const primaryEmail = `pw-auth-user-${suffix}@example.com`;
  const lockoutEmail = `pw-auth-lock-${suffix}@example.com`;
  const initialPassword = `Init#${suffix}Aa!`;
  const rotatedPassword = `Next#${suffix}Bb!`;
  let primaryUserId: number;
  let lockoutUserId: number;

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(initialPassword, 10);
    const u1 = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'Playwright Auth User', 'Recrutador', 'QA', TRUE)
       RETURNING id`,
      [primaryEmail, hash],
    );
    primaryUserId = Number(u1.rows[0].id);

    const u2 = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'Playwright Lockout User', 'Consultor', 'QA', TRUE)
       RETURNING id`,
      [lockoutEmail, hash],
    );
    lockoutUserId = Number(u2.rows[0].id);
  });

  test.afterAll(async () => {
    const userIds = [primaryUserId, lockoutUserId].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query(`DELETE FROM security_alerts WHERE user_id = ANY($1::bigint[])`, [userIds]);
      await pool.query(`DELETE FROM audit_log WHERE user_id = ANY($1::bigint[])`, [userIds]);
      await pool.query(
        `DELETE FROM login_history WHERE user_id = ANY($1::bigint[]) OR email_attempted IN ($2, $3)`,
        [userIds, primaryEmail, lockoutEmail],
      );
      await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
    }
    await pool.end();
  });

  test('login issues JWT + HttpOnly refresh cookie, exposes /me and /permissions, rotates tokens, and revokes on logout', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    try {
      // Unauthenticated guard
      const unauthRes = await ctx.get('/api/v1/auth/permissions');
      expect(unauthRes.status()).toBe(401);

      // Login
      const loginRes = await ctx.post('/api/v1/auth/login', {
        data: { email: primaryEmail, password: initialPassword },
      });
      expect(loginRes.status()).toBe(200);
      const loginBody = await loginRes.json();
      expect(loginBody.success).toBe(true);
      expect(typeof loginBody.data.accessToken).toBe('string');
      expect(loginBody.data.user.email).toBe(primaryEmail);
      expect(loginBody.data.user.passwordHash).toBeUndefined();
      expect(loginBody.data.permissions).toContain('candidates:read');

      const setCookieHeader = loginRes.headers()['set-cookie'] || '';
      expect(setCookieHeader).toContain('hr_refresh_token=');
      expect(setCookieHeader.toLowerCase()).toContain('httponly');

      // Protected /auth/me & /auth/permissions
      const meRes = await ctx.get('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
      });
      expect(meRes.status()).toBe(200);
      const meBody = await meRes.json();
      expect(meBody.data.user.role).toBe('Recrutador');

      const permsRes = await ctx.get('/api/v1/auth/permissions', {
        headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
      });
      expect(permsRes.status()).toBe(200);
      const permsBody = await permsRes.json();
      expect(permsBody.data.ttlSeconds).toBe(300);

      // Refresh rotation using HttpOnly cookie stored in ctx
      const refreshRes = await ctx.post('/api/v1/auth/refresh-token');
      expect(refreshRes.status()).toBe(200);
      const refreshBody = await refreshRes.json();
      expect(typeof refreshBody.data.accessToken).toBe('string');

      // Replay attempt with stale refresh cookie must fail
      const oldCookieValue = setCookieHeader.split(';')[0];
      const replayCtx = await playwright.request.newContext({
        baseURL: 'http://localhost:3000',
        extraHTTPHeaders: { Cookie: oldCookieValue },
      });
      try {
        const replayRes = await replayCtx.post('/api/v1/auth/refresh-token');
        expect(replayRes.status()).toBe(401);
      } finally {
        await replayCtx.dispose();
      }

      // Fresh login to establish new active session before testing logout
      const reloginRes = await ctx.post('/api/v1/auth/login', {
        data: { email: primaryEmail, password: initialPassword },
      });
      expect(reloginRes.status()).toBe(200);
      const reloginBody = await reloginRes.json();

      const logoutRes = await ctx.post('/api/v1/auth/logout', {
        headers: { Authorization: `Bearer ${reloginBody.data.accessToken}` },
      });
      expect(logoutRes.status()).toBe(200);

      // Refresh after logout must fail
      const afterLogoutRefresh = await ctx.post('/api/v1/auth/refresh-token');
      expect(afterLogoutRefresh.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('locks account after 5 wrong password attempts and enforces login rate limit on 6th attempt', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    try {
      for (let i = 1; i <= 4; i += 1) {
        const res = await ctx.post('/api/v1/auth/login', {
          data: { email: lockoutEmail, password: 'WrongPassword#99' },
        });
        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe('AUTH_001');
      }

      // 5th failure triggers DB lock (HTTP 423 AUTH_004)
      const fifth = await ctx.post('/api/v1/auth/login', {
        data: { email: lockoutEmail, password: 'WrongPassword#99' },
      });
      expect(fifth.status()).toBe(423);
      const fifthBody = await fifth.json();
      expect(fifthBody.error.code).toBe('AUTH_004');

      // Confirm DB lock + security alert persisted
      const dbUser = await pool.query(
        `SELECT login_attempts, locked_until FROM users WHERE id = $1`,
        [lockoutUserId],
      );
      expect(dbUser.rows[0].login_attempts).toBe(5);
      expect(dbUser.rows[0].locked_until).not.toBeNull();

      const alertRes = await pool.query(
        `SELECT alert_type, severity FROM security_alerts WHERE user_id = $1`,
        [lockoutUserId],
      );
      expect(alertRes.rows.length).toBeGreaterThanOrEqual(1);
      expect(alertRes.rows[0].alert_type).toBe('BRUTE_FORCE_LOCKOUT');

      // 6th attempt within window triggers Express loginLimiter (HTTP 429)
      const sixth = await ctx.post('/api/v1/auth/login', {
        data: { email: lockoutEmail, password: initialPassword },
      });
      expect(sixth.status()).toBe(429);
      const sixthBody = await sixth.json();
      expect(sixthBody.error.code).toBe('AUTH_RATE_LIMIT');
    } finally {
      await ctx.dispose();
    }
  });

  test('forgot-password creates reset token and reset-password enforces password policy and updates password', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    try {
      const forgotRes = await ctx.post('/api/v1/auth/forgot-password', {
        data: { email: primaryEmail },
      });
      expect(forgotRes.status()).toBe(200);

      const tokenCountRes = await pool.query(
        `SELECT COUNT(*)::INT AS c FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
        [primaryUserId],
      );
      expect(tokenCountRes.rows[0].c).toBeGreaterThanOrEqual(1);

      // Seed a known raw reset token to exercise /reset-password cleanly without leaking tokens in HTTP responses
      const knownRawToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [primaryUserId, hashToken(knownRawToken)],
      );

      // Weak password rejected by policy
      const weakReset = await ctx.post('/api/v1/auth/reset-password', {
        data: { token: knownRawToken, newPassword: 'weakpassword' },
      });
      expect(weakReset.status()).toBe(400);
      const weakBody = await weakReset.json();
      expect(weakBody.error.code).toBe('VAL_004');

      // Valid strong password accepted
      const validReset = await ctx.post('/api/v1/auth/reset-password', {
        data: { token: knownRawToken, newPassword: rotatedPassword },
      });
      expect(validReset.status()).toBe(200);

      // Token cannot be reused
      const reuseReset = await ctx.post('/api/v1/auth/reset-password', {
        data: { token: knownRawToken, newPassword: rotatedPassword },
      });
      expect(reuseReset.status()).toBe(400);

      // Login with newly reset password succeeds
      const loginNew = await ctx.post('/api/v1/auth/login', {
        data: { email: primaryEmail, password: rotatedPassword },
      });
      expect(loginNew.status()).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });
});
