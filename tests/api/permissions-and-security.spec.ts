import { test, expect, type APIRequestContext } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('API Integration — Granular Permissions, Security Alerts, Exports, Analytics & Retention', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const adminEmail = `pw-sec-admin-${suffix}@example.com`;
  const consultorEmail = `pw-sec-cons-${suffix}@example.com`;
  const testPassword = `Sec#${suffix}Zz!`;

  let adminId: number;
  let consultorId: number;
  let adminToken: string;
  let consultorToken: string;
  let originalConsultorPermIds: number[] = [];
  let createdAlertId: number | null = null;
  let createdReportId: number | null = null;
  let testNotificationId: number | null = null;
  let retentionBaselineDays = '30';
  let adminCtx: APIRequestContext;
  let consultorCtx: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    const hash = await bcrypt.hash(testPassword, 10);

    const aRes = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'Playwright Security Admin', 'Admin', 'Segurança', TRUE)
       RETURNING id`,
      [adminEmail, hash],
    );
    adminId = Number(aRes.rows[0].id);

    const cRes = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'Playwright Security Consultor', 'Consultor', 'Consultoria', TRUE)
       RETURNING id`,
      [consultorEmail, hash],
    );
    consultorId = Number(cRes.rows[0].id);

    const consPerms = await pool.query(
      `SELECT permission_id FROM role_permissions WHERE role = 'Consultor' ORDER BY permission_id ASC`,
    );
    originalConsultorPermIds = consPerms.rows.map((r: { permission_id: string }) =>
      Number(r.permission_id),
    );

    const retRow = await pool.query(
      `SELECT config_value FROM configurations WHERE config_key = 'RetentionNotificationsDays'`,
    );
    if (retRow.rows[0]) {
      retentionBaselineDays = retRow.rows[0].config_value;
    }

    adminCtx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    consultorCtx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });

    const adminLogin = await adminCtx.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: testPassword },
    });
    expect(adminLogin.status()).toBe(200);
    adminToken = (await adminLogin.json()).data.accessToken;

    const consLogin = await consultorCtx.post('/api/v1/auth/login', {
      data: { email: consultorEmail, password: testPassword },
    });
    expect(consLogin.status()).toBe(200);
    consultorToken = (await consLogin.json()).data.accessToken;
  });

  test.afterAll(async () => {
    if (adminToken && originalConsultorPermIds.length > 0 && adminCtx) {
      await adminCtx.put('/api/v1/permissions/roles/Consultor', {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { permissionIds: originalConsultorPermIds },
      });
    }

    await pool.query(
      `UPDATE configurations SET config_value = $1 WHERE config_key = 'RetentionNotificationsDays'`,
      [retentionBaselineDays],
    );

    if (createdReportId) {
      await pool.query(`DELETE FROM security_reports WHERE id = $1`, [createdReportId]);
    }
    if (createdAlertId) {
      await pool.query(`DELETE FROM security_alerts WHERE id = $1`, [createdAlertId]);
    }

    const userIds = [adminId, consultorId].filter(Boolean);
    if (userIds.length > 0) {
      await pool.query(`DELETE FROM retention_execution_log WHERE executed_by = ANY($1::bigint[])`, [
        userIds,
      ]);
      await pool.query(`DELETE FROM unauthorized_access_log WHERE user_id = ANY($1::bigint[])`, [
        userIds,
      ]);
      await pool.query(
        `DELETE FROM security_alerts WHERE user_id = ANY($1::bigint[])`,
        [userIds],
      );
      await pool.query(
        `DELETE FROM notifications WHERE user_id = ANY($1::bigint[]) OR message LIKE $2`,
        [userIds, `%${consultorEmail}%`],
      );
      await pool.query(`DELETE FROM audit_log WHERE user_id = ANY($1::bigint[])`, [userIds]);
      await pool.query(`DELETE FROM login_history WHERE user_id = ANY($1::bigint[])`, [userIds]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [userIds]);
    }

    if (testNotificationId) {
      await pool.query(`DELETE FROM notifications WHERE id = $1`, [testNotificationId]);
    }

    if (adminCtx) await adminCtx.dispose();
    if (consultorCtx) await consultorCtx.dispose();
    await pool.end();
  });

  test('manages permissions matrix, protects Admin role, invalidates cache, and writes audit log', async () => {
    // Non-admin blocked from /permissions/matrix
    const consDenied = await consultorCtx.get('/api/v1/permissions/matrix', {
      headers: { Authorization: `Bearer ${consultorToken}` },
    });
    expect(consDenied.status()).toBe(403);

    // Admin fetches matrix
    const matrixRes = await adminCtx.get('/api/v1/permissions/matrix', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(matrixRes.status()).toBe(200);
    const matrixBody = await matrixRes.json();
    expect(matrixBody.data.permissions).toHaveLength(28);
    expect(matrixBody.data.matrix.Admin.editable).toBe(false);

    // Protecting Admin role against edits
    const adminEditAttempt = await adminCtx.put('/api/v1/permissions/roles/Admin', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { permissionIds: originalConsultorPermIds },
    });
    expect(adminEditAttempt.status()).toBe(403);

    // Grant Consultor companies:read dynamically and verify immediate cache invalidation
    const companiesReadPerm = matrixBody.data.permissions.find(
      (p: { key: string }) => p.key === 'companies:read',
    );
    expect(companiesReadPerm).toBeDefined();

    const updateRes = await adminCtx.put('/api/v1/permissions/roles/Consultor', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { permissionIds: [...originalConsultorPermIds, Number(companiesReadPerm.id)] },
    });
    expect(updateRes.status()).toBe(200);

    const updatedConsPerms = await consultorCtx.get('/api/v1/auth/permissions', {
      headers: { Authorization: `Bearer ${consultorToken}` },
    });
    expect(updatedConsPerms.status()).toBe(200);
    const updatedConsBody = await updatedConsPerms.json();
    expect(updatedConsBody.data.permissions).toContain('companies:read');

    // Audit log captured PERMISSION_CHANGE
    const auditRes = await adminCtx.get('/api/v1/permissions/audit-log', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(auditRes.status()).toBe(200);
    const auditBody = await auditRes.json();
    expect(
      auditBody.data.items.some(
        (item: { action: string; userId: string | number }) =>
          item.action === 'PERMISSION_CHANGE' && Number(item.userId) === adminId,
      ),
    ).toBe(true);
  });

  test('escalates 5+ unauthorized attempts into HIGH alert + Admin notification and supports resolve flow', async () => {
    for (let i = 0; i < 5; i += 1) {
      const denied = await consultorCtx.get('/api/v1/permissions/matrix', {
        headers: { Authorization: `Bearer ${consultorToken}` },
      });
      expect(denied.status()).toBe(403);
    }

    const alertsRes = await adminCtx.get('/api/v1/security-alerts?status=ACTIVE&severity=HIGH', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(alertsRes.status()).toBe(200);
    const alertsBody = await alertsRes.json();
    const userAlert = alertsBody.data.items.find(
      (a: { userId: string | number | null; alertType: string }) =>
        Number(a.userId) === consultorId && a.alertType === 'REPEATED_UNAUTHORIZED_USER',
    );
    expect(userAlert).toBeDefined();
    createdAlertId = Number(userAlert.id);

    // Admin stats reflect unauthorized attempts
    const statsRes = await adminCtx.get('/api/v1/security-alerts/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(statsRes.status()).toBe(200);
    const statsBody = await statsRes.json();
    expect(statsBody.data.unauthorizedAttempts.last24h).toBeGreaterThanOrEqual(5);

    // Admin receives unread notification and marks it as read
    const notifRes = await adminCtx.get('/api/v1/notifications?unreadOnly=true', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(notifRes.status()).toBe(200);
    const notifBody = await notifRes.json();
    expect(notifBody.data.unreadCount).toBeGreaterThanOrEqual(1);
    const securityNotif = notifBody.data.items.find(
      (n: { type: string; message: string }) =>
        n.type.startsWith('SECURITY_ALERT_') && n.message.includes(consultorEmail),
    );
    expect(securityNotif).toBeDefined();
    testNotificationId = Number(securityNotif.id);

    const markReadRes = await adminCtx.put(`/api/v1/notifications/${testNotificationId}/read`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(markReadRes.status()).toBe(200);
    expect((await markReadRes.json()).data.isRead).toBe(true);

    // Resolve the security alert
    const resolveRes = await adminCtx.put(`/api/v1/security-alerts/${createdAlertId}/resolve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'RESOLVED', resolutionNote: 'Verificado pela suíte Playwright' },
    });
    expect(resolveRes.status()).toBe(200);
    expect((await resolveRes.json()).data.status).toBe('RESOLVED');
  });

  test('exports CSV/PDF, generates SecurityReports analytics, and executes Retention policies', async () => {
    // Ensure at least one unauthorized attempt exists for this worker's consultorEmail before exporting
    const denied = await consultorCtx.get('/api/v1/permissions/matrix', {
      headers: { Authorization: `Bearer ${consultorToken}` },
    });
    expect(denied.status()).toBe(403);

    const csvLogsRes = await adminCtx.get('/api/v1/exports/unauthorized-access-logs/csv', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(csvLogsRes.status()).toBe(200);
    expect(csvLogsRes.headers()['content-type']).toContain('text/csv');
    const csvText = await csvLogsRes.text();
    expect(csvText).toContain('ID;UserID;Email;Resource;Action');
    expect(csvText).toContain(consultorEmail);

    const csvAlertsRes = await adminCtx.get('/api/v1/exports/security-alerts/csv', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(csvAlertsRes.status()).toBe(200);
    expect(await csvAlertsRes.text()).toContain('ID;AlertType;Severity;Status');

    const pdfRes = await adminCtx.get('/api/v1/exports/unauthorized-access-logs/pdf', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()['content-type']).toContain('application/pdf');
    const pdfBuf = await pdfRes.body();
    expect(pdfBuf.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    // Generate security report
    const genRes = await adminCtx.post('/api/v1/analytics/generate-report', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {},
    });
    expect(genRes.status()).toBe(201);
    const genBody = await genRes.json();
    createdReportId = Number(genBody.data.id);
    expect(genBody.data.riskScore).toBeGreaterThanOrEqual(0);
    expect(genBody.data.riskScore).toBeLessThanOrEqual(100);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(genBody.data.riskLevel);

    const reportByIdRes = await adminCtx.get(`/api/v1/analytics/reports/${createdReportId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(reportByIdRes.status()).toBe(200);

    // Retention policies, dryRun, and real execution on an expired test notification
    const policiesRes = await adminCtx.get('/api/v1/retention/policies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(policiesRes.status()).toBe(200);
    expect((await policiesRes.json()).data.items.length).toBeGreaterThanOrEqual(5);

    const oldNotif = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, 'TEST_OLD', 'Old notification', 'To be pruned', TRUE, NOW() - INTERVAL '45 days')
       RETURNING id`,
      [adminId],
    );
    const oldNotifId = Number(oldNotif.rows[0].id);

    const updatePolicyRes = await adminCtx.put('/api/v1/retention/policies/RetentionNotificationsDays', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { days: 30 },
    });
    expect(updatePolicyRes.status()).toBe(200);

    const dryRunRes = await adminCtx.post('/api/v1/retention/execute', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { dryRun: true },
    });
    expect(dryRunRes.status()).toBe(200);
    expect((await dryRunRes.json()).data.policySummary.RetentionNotificationsDays.wouldDelete).toBeGreaterThanOrEqual(1);

    const execRes = await adminCtx.post('/api/v1/retention/execute', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { dryRun: false },
    });
    expect(execRes.status()).toBe(200);
    expect((await execRes.json()).data.recordsDeleted).toBeGreaterThanOrEqual(1);

    const stillExists = await pool.query(`SELECT id FROM notifications WHERE id = $1`, [oldNotifId]);
    expect(stillExists.rows).toHaveLength(0);

    const historyRes = await adminCtx.get('/api/v1/retention/history', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(historyRes.status()).toBe(200);
    expect((await historyRes.json()).data.items.length).toBeGreaterThanOrEqual(1);
  });
});
