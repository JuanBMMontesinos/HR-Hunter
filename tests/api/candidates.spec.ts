import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Candidates CRUD, Optional NULL CPF, Sub-resources & CSV Import', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const actorEmail = `pw3-cand-${suffix}@example.com`;
  const password = `Pw3Cand#${suffix}!`;
  let actorUserId: number;
  const createdCandidateIds: number[] = [];

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const u = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'PW3 Recrutador Cand', 'Recrutador', 'Recrutamento', TRUE)
       RETURNING id`,
      [actorEmail, hash],
    );
    actorUserId = Number(u.rows[0].id);
  });

  test.afterAll(async () => {
    if (createdCandidateIds.length > 0) {
      await pool.query(`DELETE FROM candidates WHERE id = ANY($1::bigint[])`, [createdCandidateIds]);
    }
    if (actorUserId) {
      await pool.query(`DELETE FROM audit_log WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM login_history WHERE user_id = $1`, [actorUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [actorUserId]);
    }
    await pool.end();
  });

  test('allows multiple candidates with empty/NULL CPF, supports sub-resources CRUD and CSV bulk import', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const loginRes = await ctx.post('/api/v1/auth/login', { data: { email: actorEmail, password } });
    expect(loginRes.status()).toBe(200);
    const token = (await loginRes.json()).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // Create 1st candidate WITHOUT CPF ("" -> NULL) + nested experience, education, skills
    const c1Res = await ctx.post('/api/v1/candidates', {
      headers,
      data: {
        fullName: `Candidato Sem CPF 1 ${suffix}`,
        email: `pw3-c1-${suffix}@example.com`,
        cpf: '',
        desiredPosition: 'Product Designer',
        desiredSalary: 9500,
        experiences: [
          { company: 'Studio Alpha', position: 'UX Designer', startDate: '2023-01-15' },
        ],
        education: [
          { institution: 'USP', course: 'Design', level: 'Graduação', yearConclusion: 2020, status: 'Concluído' },
        ],
        skills: [{ skill: 'Figma', level: 'Especialista' }],
      },
    });
    expect(c1Res.status()).toBe(201);
    const c1 = (await c1Res.json()).data;
    createdCandidateIds.push(c1.id);
    expect(c1.cpf).toBeNull();

    // Create 2nd candidate ALSO WITHOUT CPF -> proves partial unique index allows multiple NULLs
    const c2Res = await ctx.post('/api/v1/candidates', {
      headers,
      data: {
        fullName: `Candidato Sem CPF 2 ${suffix}`,
        email: `pw3-c2-${suffix}@example.com`,
        cpf: '   ',
      },
    });
    expect(c2Res.status()).toBe(201);
    const c2 = (await c2Res.json()).data;
    createdCandidateIds.push(c2.id);
    expect(c2.cpf).toBeNull();

    // Skill filter search finds c1
    const bySkillRes = await ctx.get(`/api/v1/candidates?skill=Figma&search=${encodeURIComponent(suffix)}`, {
      headers,
    });
    expect(bySkillRes.status()).toBe(200);
    expect((await bySkillRes.json()).data.items.map((x: { id: number }) => x.id)).toContain(c1.id);

    // Get full profile
    const detailRes = await ctx.get(`/api/v1/candidates/${c1.id}`, { headers });
    expect(detailRes.status()).toBe(200);
    const detail = (await detailRes.json()).data;
    expect(detail.experiences).toHaveLength(1);
    expect(detail.education).toHaveLength(1);
    expect(detail.skills).toHaveLength(1);

    // Sub-resources POST / PUT / DELETE
    const addSkillRes = await ctx.post(`/api/v1/candidates/${c1.id}/skills`, {
      headers,
      data: { skill: 'Design Systems', level: 'Avançado' },
    });
    expect(addSkillRes.status()).toBe(201);
    const addedSkill = (await addSkillRes.json()).data;

    const updSkillRes = await ctx.put(`/api/v1/candidates/${c1.id}/skills/${addedSkill.id}`, {
      headers,
      data: { level: 'Especialista' },
    });
    expect(updSkillRes.status()).toBe(200);
    expect((await updSkillRes.json()).data.level).toBe('Especialista');

    const delSkillRes = await ctx.delete(`/api/v1/candidates/${c1.id}/skills/${addedSkill.id}`, { headers });
    expect(delSkillRes.status()).toBe(200);

    // CSV bulk import via multipart upload (1 valid, 1 duplicate email error)
    const csvPayload = [
      'fullName;email;cpf;desiredPosition;desiredSalary',
      `CSV Importado ${suffix};pw3-csv-${suffix}@example.com;;QA Automation;11000`,
      `Duplicado ${suffix};pw3-c1-${suffix}@example.com;;Designer;9000`,
    ].join('\n');

    const importRes = await ctx.post('/api/v1/candidates/import', {
      headers,
      multipart: {
        file: {
          name: 'candidates.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(`\uFEFF${csvPayload}`, 'utf8'),
        },
      },
    });
    expect(importRes.status()).toBe(200);
    const importData = (await importRes.json()).data;
    expect(importData.importedCount).toBe(1);
    expect(importData.failedCount).toBe(1);
    createdCandidateIds.push(...importData.createdIds);

    // Soft delete candidate without active process
    const delCandRes = await ctx.delete(`/api/v1/candidates/${c2.id}`, { headers });
    expect(delCandRes.status()).toBe(200);
    expect((await delCandRes.json()).data.status).toBe('Inativo');

    await ctx.dispose();
  });
});
