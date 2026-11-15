import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Companies CRUD & Active Jobs Protection', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const actorEmail = `pw3-co-${suffix}@example.com`;
  const password = `Pw3Co#${suffix}!`;
  const createdCompanyIds: number[] = [];
  const createdJobIds: number[] = [];
  let actorUserId: number;
  let token = '';

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'PW3 Gerente Companies', 'Gerente', 'Recrutamento', TRUE)
       RETURNING id`,
      [actorEmail, hash],
    );
    actorUserId = Number(u.rows[0].id);
  });

  test.afterAll(async () => {
    if (createdJobIds.length > 0) {
      await pool.query(`DELETE FROM job_openings WHERE id = ANY($1::bigint[])`, [createdJobIds]);
    }
    if (createdCompanyIds.length > 0) {
      await pool.query(`DELETE FROM companies WHERE id = ANY($1::bigint[])`, [createdCompanyIds]);
    }
    if (actorUserId) {
      await pool.query(`DELETE FROM audit_log WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM login_history WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [actorUserId]);
    }
    await pool.end();
  });

  test('supports create, unique CNPJ conflict, pagination limit<=20, stats, update, and soft delete guard', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const loginRes = await ctx.post('/api/v1/auth/login', { data: { email: actorEmail, password } });
    expect(loginRes.status()).toBe(200);
    token = (await loginRes.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    const cnpj = `99.${String(Date.now()).slice(-3)}.${String(Math.floor(Math.random() * 900 + 100))}/0001-88`;
    const createRes = await ctx.post('/api/v1/companies', {
      headers,
      data: {
        legalName: `Empresa Playwright ${suffix} Ltda`,
        tradeName: `PW Tech ${suffix}`,
        cnpj,
        sector: 'Tecnologia',
        city: 'Curitiba',
        state: 'PR',
        email: `contato-${suffix}@example.com`,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()).data;
    createdCompanyIds.push(created.id);
    expect(created.status).toBe('Ativo');

    // Duplicate CNPJ must fail cleanly with 409 VAL_003
    const dupRes = await ctx.post('/api/v1/companies', {
      headers,
      data: { legalName: 'Outra Ltda', cnpj },
    });
    expect(dupRes.status()).toBe(409);
    expect((await dupRes.json()).error.code).toBe('VAL_003');

    // List filters + max 20/page validation cap
    const badLimitRes = await ctx.get('/api/v1/companies?limit=50', { headers });
    expect(badLimitRes.status()).toBe(400);

    const listRes = await ctx.get(`/api/v1/companies?name=${encodeURIComponent(suffix)}&limit=20`, { headers });
    expect(listRes.status()).toBe(200);
    const listData = (await listRes.json()).data;
    expect(listData.limit).toBeLessThanOrEqual(20);
    expect(listData.items.some((c: { id: number }) => c.id === created.id)).toBe(true);

    // Get by ID with stats
    const getRes = await ctx.get(`/api/v1/companies/${created.id}`, { headers });
    expect(getRes.status()).toBe(200);
    expect((await getRes.json()).data.stats.totalJobOpenings).toBe(0);

    // Update company
    const updRes = await ctx.put(`/api/v1/companies/${created.id}`, {
      headers,
      data: { sector: 'FinTech', city: 'Florianópolis' },
    });
    expect(updRes.status()).toBe(200);
    expect((await updRes.json()).data.sector).toBe('FinTech');

    // Insert an open job directly via API to test delete guard
    const jobRes = await ctx.post('/api/v1/job-openings', {
      headers,
      data: { companyId: created.id, title: `Vaga Guard ${suffix}`, status: 'Aberta' },
    });
    expect(jobRes.status()).toBe(201);
    const jobId = (await jobRes.json()).data.id;
    createdJobIds.push(jobId);

    const blockedDelRes = await ctx.delete(`/api/v1/companies/${created.id}`, { headers });
    expect(blockedDelRes.status()).toBe(409);

    // Cancel job opening then soft-delete company
    const cancelJobRes = await ctx.put(`/api/v1/job-openings/${jobId}`, {
      headers,
      data: { status: 'Cancelada' },
    });
    expect(cancelJobRes.status()).toBe(200);

    const softDelRes = await ctx.delete(`/api/v1/companies/${created.id}`, { headers });
    expect(softDelRes.status()).toBe(200);
    expect((await softDelRes.json()).data.status).toBe('Inativo');

    await ctx.dispose();
  });
});
