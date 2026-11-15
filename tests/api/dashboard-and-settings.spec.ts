import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Dashboard Analytics & Settings (Stages, Funnels, Templates, Logs, Backup)', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const adminEmail = `pw3-sadmin-${suffix}@example.com`;
  const consultorEmail = `pw3-scons-${suffix}@example.com`;
  const password = `Pw3Settings#${suffix}!`;
  const userIds: number[] = [];
  const createdStageIds: number[] = [];
  const createdFunnelIds: number[] = [];
  const createdTemplateIds: number[] = [];
  let originalAppName = 'HR Hunter';

  test.beforeAll(async () => {
    const appRes = await pool.query(`SELECT config_value FROM configurations WHERE config_key = 'AppName' LIMIT 1`);
    if (appRes.rows[0]?.config_value) originalAppName = appRes.rows[0].config_value;

    const hash = await bcrypt.hash(password, 10);
    for (const [email, name, role] of [
      [adminEmail, 'PW3 Admin Settings', 'Admin'],
      [consultorEmail, 'PW3 Consultor Settings', 'Consultor'],
    ]) {
      const r = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
         VALUES ($1, $2, $3, $4, 'Tech', TRUE) RETURNING id`,
        [email, hash, name, role],
      );
      userIds.push(Number(r.rows[0].id));
    }
  });

  test.afterAll(async () => {
    await pool.query(`UPDATE configurations SET config_value = $1 WHERE config_key = 'AppName'`, [
      originalAppName,
    ]);
    if (createdFunnelIds.length > 0) {
      await pool.query(`DELETE FROM stage_funnels WHERE id = ANY($1::bigint[])`, [createdFunnelIds]);
    }
    if (createdStageIds.length > 0) {
      await pool.query(`DELETE FROM recruitment_stage_template WHERE id = ANY($1::bigint[])`, [
        createdStageIds,
      ]);
    }
    if (createdTemplateIds.length > 0) {
      await pool.query(`DELETE FROM email_templates WHERE id = ANY($1::bigint[])`, [createdTemplateIds]);
    }
    const ids = userIds.filter(Boolean);
    if (ids.length > 0) {
      await pool.query(`DELETE FROM notifications WHERE message LIKE $1 OR user_id = ANY($2::bigint[])`, [
        `%${consultorEmail}%`,
        ids,
      ]);
      await pool.query(`DELETE FROM security_alerts WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM unauthorized_access_log WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM audit_log WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM login_history WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [ids]);
    }
    await pool.end();
  });

  test('executes Dashboard SQL functions and Settings CRUD, XSS sanitization, system template guard & logical backup', async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const adminLogin = await ctx.post('/api/v1/auth/login', { data: { email: adminEmail, password } });
    expect(adminLogin.status()).toBe(200);
    const adminToken = (await adminLogin.json()).data.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const consLogin = await ctx.post('/api/v1/auth/login', { data: { email: consultorEmail, password } });
    expect(consLogin.status()).toBe(200);
    const consToken = (await consLogin.json()).data.accessToken;
    const consHeaders = { Authorization: `Bearer ${consToken}` };

    // 1. Dashboard endpoints (Admin has dashboard:read; Consultor lacks dashboard:read -> 403)
    const consDashRes = await ctx.get('/api/v1/dashboard/kpis', { headers: consHeaders });
    expect(consDashRes.status()).toBe(403);

    const kpisRes = await ctx.get('/api/v1/dashboard/kpis', { headers: adminHeaders });
    expect(kpisRes.status()).toBe(200);
    const kpis = (await kpisRes.json()).data;
    expect(typeof kpis.totalCompanies).toBe('number');
    expect(typeof kpis.conversionRate).toBe('number');

    const analyticsRes = await ctx.get('/api/v1/dashboard/analytics', { headers: adminHeaders });
    expect(analyticsRes.status()).toBe(200);
    const analytics = (await analyticsRes.json()).data;
    expect(Array.isArray(analytics.candidatesByStage)).toBe(true);
    expect(Array.isArray(analytics.topCompanies)).toBe(true);

    const critRes = await ctx.get('/api/v1/dashboard/critical-processes', { headers: adminHeaders });
    expect(critRes.status()).toBe(200);
    expect(Array.isArray((await critRes.json()).data.items)).toBe(true);

    // 2. Settings general get/update (Non-admin blocked from GET /settings -> 403)
    const consSetRes = await ctx.get('/api/v1/settings', { headers: consHeaders });
    expect(consSetRes.status()).toBe(403);

    const getSetRes = await ctx.get('/api/v1/settings', { headers: adminHeaders });
    expect(getSetRes.status()).toBe(200);
    expect((await getSetRes.json()).data.map.AppName).toBeTruthy();

    const updSetRes = await ctx.put('/api/v1/settings', {
      headers: adminHeaders,
      data: { AppName: `HR Hunter PW ${suffix}` },
    });
    expect(updSetRes.status()).toBe(200);
    expect((await updSetRes.json()).data.map.AppName).toBe(`HR Hunter PW ${suffix}`);

    // Restore right away
    await ctx.put('/api/v1/settings', {
      headers: adminHeaders,
      data: { AppName: originalAppName },
    });

    // 3. Stages & Funnels CRUD
    const stageRes = await ctx.post('/api/v1/settings/stages', {
      headers: adminHeaders,
      data: { stageName: `Desafio PW ${suffix}`, stageOrder: 99, requiresFeedback: true },
    });
    expect(stageRes.status()).toBe(201);
    const stage = (await stageRes.json()).data;
    createdStageIds.push(stage.id);

    const funnelRes = await ctx.post('/api/v1/settings/funnels', {
      headers: adminHeaders,
      data: { name: `Funil PW ${suffix}`, stageIds: [stage.id], isDefault: false },
    });
    expect(funnelRes.status()).toBe(201);
    const funnel = (await funnelRes.json()).data;
    createdFunnelIds.push(funnel.id);
    expect(funnel.items).toHaveLength(1);

    // Delete funnel first (releasing FK on stage), then delete stage cleanly
    expect((await ctx.delete(`/api/v1/settings/funnels/${funnel.id}`, { headers: adminHeaders })).status()).toBe(
      200,
    );
    expect((await ctx.delete(`/api/v1/settings/stages/${stage.id}`, { headers: adminHeaders })).status()).toBe(
      200,
    );

    // 4. Email templates CRUD: XSS sanitization + protection against deleting isSystem=true
    const tplRes = await ctx.post('/api/v1/settings/email-templates', {
      headers: adminHeaders,
      data: {
        templateKey: `pw_tpl_${suffix.replace('-', '_')}`,
        name: `Template PW ${suffix}`,
        subject: 'Assunto {{candidateName}}',
        bodyHtml: '<p>Olá {{candidateName}}</p><script>alert("xss")</script>',
        variables: ['candidateName'],
      },
    });
    expect(tplRes.status()).toBe(201);
    const createdTpl = (await tplRes.json()).data;
    createdTemplateIds.push(createdTpl.id);
    expect(createdTpl.bodyHtml).not.toContain('<script>');

    const listTplRes = await ctx.get('/api/v1/settings/email-templates', { headers: adminHeaders });
    const allTemplates = (await listTplRes.json()).data;
    const systemTpl = allTemplates.find((t: { isSystem: boolean }) => t.isSystem);
    expect(systemTpl).toBeTruthy();

    const delSysRes = await ctx.delete(`/api/v1/settings/email-templates/${systemTpl.id}`, {
      headers: adminHeaders,
    });
    expect(delSysRes.status()).toBe(403);

    expect(
      (await ctx.delete(`/api/v1/settings/email-templates/${createdTpl.id}`, { headers: adminHeaders })).status(),
    ).toBe(200);

    // 5. Audit log, Login history & Logical Backup Snapshot (JSON & SQL)
    const auditRes = await ctx.get('/api/v1/settings/audit-log?limit=10', { headers: adminHeaders });
    expect(auditRes.status()).toBe(200);
    expect((await auditRes.json()).data.items.length).toBeGreaterThanOrEqual(1);

    const loginHistRes = await ctx.get(`/api/v1/settings/login-history?userId=${userIds[0]}`, {
      headers: adminHeaders,
    });
    expect(loginHistRes.status()).toBe(200);
    expect((await loginHistRes.json()).data.items.length).toBeGreaterThanOrEqual(1);

    const backupJsonRes = await ctx.post('/api/v1/settings/backup', {
      headers: adminHeaders,
      data: { format: 'json', download: false },
    });
    expect(backupJsonRes.status()).toBe(200);
    const snap = (await backupJsonRes.json()).data;
    expect(snap.metadata.projectRef).toBe('fhhgtjzwmhgdiokqqebg');
    expect(snap.tableCounts.users).toBeGreaterThanOrEqual(5);
    expect(snap.tables.users[0].passwordHash).toBeUndefined();

    const backupSqlRes = await ctx.post('/api/v1/settings/backup', {
      headers: adminHeaders,
      data: { format: 'sql', download: false },
    });
    expect(backupSqlRes.status()).toBe(200);
    expect((await backupSqlRes.json()).data.sqlContent).toContain('INSERT INTO companies');

    await ctx.dispose();
  });
});
