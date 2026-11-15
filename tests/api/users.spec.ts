import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Users CRUD, Self-Profile Restriction, Activity & Admin Password Reset', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const adminEmail = `pw3-uadmin-${suffix}@example.com`;
  const recruiterEmail = `pw3-urec-${suffix}@example.com`;
  const createdEmail = `pw3-unew-${suffix}@example.com`;
  const password = `Pw3Users#${suffix}!`;
  const userIds: number[] = [];

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    for (const [email, name, role] of [
      [adminEmail, 'PW3 Admin Users', 'Admin'],
      [recruiterEmail, 'PW3 Recruiter Users', 'Recrutador'],
    ]) {
      const r = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
         VALUES ($1, $2, $3, $4, 'QA', TRUE) RETURNING id`,
        [email, hash, name, role],
      );
      userIds.push(Number(r.rows[0].id));
    }
  });

  test.afterAll(async () => {
    const ids = userIds.filter(Boolean);
    if (ids.length > 0) {
      await pool.query(`DELETE FROM notifications WHERE message LIKE $1 OR user_id = ANY($2::bigint[])`, [
        `%${recruiterEmail}%`,
        ids,
      ]);
      await pool.query(`DELETE FROM security_alerts WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM unauthorized_access_log WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM audit_log WHERE user_id = ANY($1::bigint[]) OR (table_name = 'users' AND record_id = ANY($1::bigint[]))`, [
        ids,
      ]);
      await pool.query(`DELETE FROM login_history WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [ids]);
    }
    await pool.end();
  });

  test('enforces Admin-only user management, allows restricted self-profile update, reset password and soft delete', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const [adminId, recruiterId] = userIds;

    const adminLogin = await ctx.post('/api/v1/auth/login', { data: { email: adminEmail, password } });
    expect(adminLogin.status()).toBe(200);
    const adminToken = (await adminLogin.json()).data.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const recLogin = await ctx.post('/api/v1/auth/login', { data: { email: recruiterEmail, password } });
    expect(recLogin.status()).toBe(200);
    const recToken = (await recLogin.json()).data.accessToken;
    const recHeaders = { Authorization: `Bearer ${recToken}` };

    // Non-admin cannot list all users or escalate own role
    const forbiddenList = await ctx.get('/api/v1/users', { headers: recHeaders });
    expect(forbiddenList.status()).toBe(403);

    const forbiddenRoleUpgrade = await ctx.put(`/api/v1/users/${recruiterId}`, {
      headers: recHeaders,
      data: { role: 'Admin' },
    });
    expect(forbiddenRoleUpgrade.status()).toBe(403);

    // Non-admin CAN view & update own allowed fields + view activity
    const selfGet = await ctx.get(`/api/v1/users/${recruiterId}`, { headers: recHeaders });
    expect(selfGet.status()).toBe(200);

    const selfUpd = await ctx.put(`/api/v1/users/${recruiterId}`, {
      headers: recHeaders,
      data: { fullName: 'Recruiter Updated Self', preferredLanguage: 'en-US' },
    });
    expect(selfUpd.status()).toBe(200);
    expect((await selfUpd.json()).data.fullName).toBe('Recruiter Updated Self');

    const selfActivity = await ctx.get(`/api/v1/users/${recruiterId}/activity`, { headers: recHeaders });
    expect(selfActivity.status()).toBe(200);
    expect((await selfActivity.json()).data.recentLogins.length).toBeGreaterThanOrEqual(1);

    // Admin creates user (validates weak password -> 400 VAL_004 first)
    const weakUserRes = await ctx.post('/api/v1/users', {
      headers: adminHeaders,
      data: {
        email: createdEmail,
        password: 'weakpassword',
        fullName: 'Novo Usuario',
        role: 'Consultor',
      },
    });
    expect(weakUserRes.status()).toBe(400);
    expect((await weakUserRes.json()).error.code).toBe('VAL_004');

    const createRes = await ctx.post('/api/v1/users', {
      headers: adminHeaders,
      data: {
        email: createdEmail,
        password: `Strong#${suffix}!`,
        fullName: `Novo Consultor ${suffix}`,
        role: 'Consultor',
        department: 'Consultoria',
        managerId: adminId,
      },
    });
    expect(createRes.status()).toBe(201);
    const createdUser = (await createRes.json()).data;
    userIds.push(createdUser.id);
    expect(createdUser.passwordHash).toBeUndefined();

    // Admin resets password -> sets isPasswordResetRequired = true
    const resetRes = await ctx.post(`/api/v1/users/${createdUser.id}/reset-password`, {
      headers: adminHeaders,
      data: { requireResetOnLogin: true, sendEmail: false },
    });
    expect(resetRes.status()).toBe(200);
    const resetData = (await resetRes.json()).data;
    expect(resetData.user.isPasswordResetRequired).toBe(true);
    expect(resetData.temporaryPassword).toBeTruthy();

    // Admin soft-deletes created user
    const delRes = await ctx.delete(`/api/v1/users/${createdUser.id}`, { headers: adminHeaders });
    expect(delRes.status()).toBe(200);
    expect((await delRes.json()).data.isActive).toBe(false);

    await ctx.dispose();
  });
});
