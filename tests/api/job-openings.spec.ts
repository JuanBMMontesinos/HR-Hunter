import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Job Openings CRUD, Aliases, Preenchida Lock & Analytics', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const actorEmail = `pw3-job-${suffix}@example.com`;
  const password = `Pw3Job#${suffix}!`;
  let actorUserId: number;
  let companyId: number;
  let candidateId: number;
  const createdJobIds: number[] = [];

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'PW3 Recrutador Jobs', 'Recrutador', 'RH', TRUE)
       RETURNING id`,
      [actorEmail, hash],
    );
    actorUserId = Number(u.rows[0].id);

    const comp = await pool.query(
      `INSERT INTO companies (legal_name, cnpj, status)
       VALUES ($1, $2, 'Ativo') RETURNING id`,
      [`PW3 Jobs Co ${suffix}`, `88.${String(Date.now()).slice(-3)}.111/0001-22`],
    );
    companyId = Number(comp.rows[0].id);

    const cand = await pool.query(
      `INSERT INTO candidates (full_name, email, status)
       VALUES ($1, $2, 'Ativo') RETURNING id`,
      [`Cand Job Test ${suffix}`, `pw3-jc-${suffix}@example.com`],
    );
    candidateId = Number(cand.rows[0].id);
  });

  test.afterAll(async () => {
    if (createdJobIds.length > 0) {
      await pool.query(`DELETE FROM recruitment_processes WHERE job_opening_id = ANY($1::bigint[])`, [
        createdJobIds,
      ]);
      await pool.query(`DELETE FROM job_openings WHERE id = ANY($1::bigint[])`, [createdJobIds]);
    }
    if (candidateId) await pool.query(`DELETE FROM candidates WHERE id = $1`, [candidateId]);
    if (companyId) await pool.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
    if (actorUserId) {
      await pool.query(`DELETE FROM audit_log WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM login_history WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [actorUserId]);
    }
    await pool.end();
  });

  test('normalizes salary aliases, blocks updates on Preenchida, exposes candidates/analytics and guards active delete', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const loginRes = await ctx.post('/api/v1/auth/login', { data: { email: actorEmail, password } });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    const funnelRow = await pool.query(`SELECT id FROM stage_funnels WHERE is_active = TRUE LIMIT 1`);
    const funnelId = Number(funnelRow.rows[0].id);

    const createRes = await ctx.post('/api/v1/job-openings', {
      headers,
      data: {
        companyId,
        funnelId,
        title: `Staff Engineer ${suffix}`,
        department: 'Engenharia',
        level: 'Sênior',
        contractType: 'CLT',
        regime: 'Remoto',
        salaryMin: 15000,
        salaryMax: 22000,
        openedAt: new Date().toISOString(),
        priority: 'Alta',
      },
    });
    expect(createRes.status()).toBe(201);
    const job1 = (await createRes.json()).data;
    createdJobIds.push(job1.id);
    expect(job1.minSalary).toBe(15000);
    expect(job1.maxSalary).toBe(22000);

    // Filter search
    const listRes = await ctx.get(
      `/api/v1/job-openings?companyId=${companyId}&level=S%C3%AAnior&search=${encodeURIComponent(suffix)}`,
      { headers },
    );
    expect(listRes.status()).toBe(200);
    const listData = (await listRes.json()).data;
    expect(listData.items).toHaveLength(1);
    expect(listData.items[0].totalCandidates).toBe(0);

    // Link an active process then verify DELETE guard + /candidates + /analytics
    const procRes = await ctx.post('/api/v1/processes', {
      headers,
      data: { jobOpeningId: job1.id, candidateId, feedback: 'Inscrito para teste.' },
    });
    expect(procRes.status()).toBe(201);
    const procId = (await procRes.json()).data.id;

    const candListRes = await ctx.get(`/api/v1/job-openings/${job1.id}/candidates`, { headers });
    expect(candListRes.status()).toBe(200);
    expect((await candListRes.json()).data).toHaveLength(1);

    const analyticsRes = await ctx.get(`/api/v1/job-openings/${job1.id}/analytics`, { headers });
    expect(analyticsRes.status()).toBe(200);
    const analytics = (await analyticsRes.json()).data;
    expect(analytics.jobOpening.totalCandidates).toBe(1);
    expect(Array.isArray(analytics.candidatesByStage)).toBe(true);

    const blockedDeleteRes = await ctx.delete(`/api/v1/job-openings/${job1.id}`, { headers });
    expect(blockedDeleteRes.status()).toBe(409);

    // Conclude process via reject, mark job Preenchida, and assert edit lock
    await ctx.post(`/api/v1/processes/${procId}/reject`, {
      headers,
      data: { reason: 'Vaga fechada internamente para teste.', sendEmail: false },
    });

    const fillRes = await ctx.put(`/api/v1/job-openings/${job1.id}`, {
      headers,
      data: { status: 'Preenchida' },
    });
    expect(fillRes.status()).toBe(200);
    expect((await fillRes.json()).data.closedAt).toBeTruthy();

    const lockedUpdateRes = await ctx.put(`/api/v1/job-openings/${job1.id}`, {
      headers,
      data: { title: 'Nao pode editar' },
    });
    expect(lockedUpdateRes.status()).toBe(409);

    // Job with 0 processes hard-deletes cleanly
    const job2Res = await ctx.post('/api/v1/job-openings', {
      headers,
      data: { companyId, title: `Temp Job ${suffix}` },
    });
    expect(job2Res.status()).toBe(201);
    const job2Id = (await job2Res.json()).data.id;

    const del2Res = await ctx.delete(`/api/v1/job-openings/${job2Id}`, { headers });
    expect(del2Res.status()).toBe(200);
    expect((await del2Res.json()).data.deleted).toBe(true);

    await ctx.dispose();
  });
});
