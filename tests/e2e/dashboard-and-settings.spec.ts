import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('E2E — Phase 5 Analytical Dashboard & Administrative Settings (9 Tabs)', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const adminEmail = `pw5-settings-${suffix}@example.com`;
  const password = `Pw5Set#${suffix}!`;
  const tempStageName = `Etapa PW5 ${suffix}`;
  let adminUserId: number;
  let originalConsultorPermIds: number[] = [];

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'PW5 Settings Admin', 'Admin', 'Segurança', TRUE)
       RETURNING id`,
      [adminEmail, hash],
    );
    adminUserId = Number(res.rows[0].id);

    const consultorPerms = await pool.query(
      `SELECT permission_id FROM role_permissions WHERE role = 'Consultor' ORDER BY permission_id`,
    );
    originalConsultorPermIds = consultorPerms.rows.map((r: { permission_id: number }) =>
      Number(r.permission_id),
    );
  });

  test.afterAll(async () => {
    // Restore original Consultor role permissions in case a failure aborted mid-test
    if (originalConsultorPermIds.length >= 0) {
      await pool.query(`DELETE FROM role_permissions WHERE role = 'Consultor'`);
      for (const permId of originalConsultorPermIds) {
        await pool.query(
          `INSERT INTO role_permissions (role, permission_id) VALUES ('Consultor', $1) ON CONFLICT DO NOTHING`,
          [permId],
        );
      }
    }

    await pool.query(`DELETE FROM recruitment_stage_template WHERE stage_name = $1`, [tempStageName]);

    if (adminUserId) {
      await pool.query(`DELETE FROM security_reports WHERE created_by = $1`, [adminUserId]);
      await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [adminUserId]);
      await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [adminUserId]);
      await pool.query(`DELETE FROM audit_log WHERE user_id = $1`, [adminUserId]);
      await pool.query(
        `DELETE FROM login_history WHERE user_id = $1 OR email_attempted = $2`,
        [adminUserId, adminEmail],
      );
      await pool.query(`DELETE FROM users WHERE id = $1`, [adminUserId]);
    }
    await pool.end();
  });

  test('renders analytical Dashboard KPIs/charts and operates all 9 Settings admin tabs', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // Login as ephemeral Admin
    await page.goto('/login');
    await page.getByLabel(/E-mail corporativo/).fill(adminEmail);
    await page.getByLabel('Senha', { exact: false }).first().fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    // 1. Dashboard Verification
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByTestId('kpi-companies')).toBeVisible();
    await expect(page.getByTestId('kpi-active-jobs')).toBeVisible();
    await expect(page.getByTestId('kpi-candidates')).toBeVisible();
    await expect(page.getByTestId('kpi-processes')).toBeVisible();
    await expect(page.getByTestId('kpi-offers')).toBeVisible();
    await expect(page.getByTestId('kpi-conversion')).toBeVisible();
    await expect(page.getByTestId('kpi-avg-days')).toBeVisible();

    await expect(page.getByTestId('chart-by-stage')).toBeVisible();
    await expect(page.getByTestId('chart-jobs-status')).toBeVisible();
    await expect(page.getByTestId('chart-by-dept')).toBeVisible();
    await expect(page.getByTestId('chart-evolution')).toBeVisible();
    await expect(page.getByTestId('critical-processes-card')).toBeVisible();
    await expect(page.getByTestId('top-companies-card')).toBeVisible();

    await page.getByTestId('chart-by-stage-toggle').click();
    await expect(page.getByTestId('chart-by-stage').locator('table')).toBeVisible();

    await page.getByLabel(/Período/).selectOption('90d');
    await page.getByTestId('dashboard-refresh-btn').click();

    // 2. Settings — 9 Tabs
    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Configurações' }).click();
    await expect(page.getByTestId('settings-page')).toBeVisible();

    // Tab 1: General
    await expect(page.getByTestId('settings-tab-general')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('settings-tab-panel-general')).toBeVisible();

    // Tab 2: Stages & Funnels (keyboard ArrowRight + Enter)
    await page.getByTestId('settings-tab-general').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('settings-tab-stages')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('settings-tab-panel-stages')).toBeVisible();

    await page.getByTestId('new-stage-btn').click();
    const stageDialog = page.locator('dialog[open]');
    await stageDialog.getByLabel(/Nome da Etapa/).fill(tempStageName);
    await stageDialog.getByLabel(/Ordem/).fill('99');
    await stageDialog.getByTestId('stage-save-btn').click();
    await expect(page.getByText('Etapa salva com sucesso.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('settings-tab-panel-stages')).toContainText(tempStageName);

    // Tab 3: Email & Templates
    await page.getByTestId('settings-tab-email').click();
    await expect(page.getByTestId('settings-tab-panel-email')).toContainText('SMTP');

    // Tab 4: Security & Retention (Dry-Run)
    await page.getByTestId('settings-tab-security-retention').click();
    await expect(page.getByTestId('settings-tab-panel-security-retention')).toContainText(
      'Retenção',
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: /Simular Limpeza/ }).click();
    await expect(page.getByText(/Simulação concluída/)).toBeVisible({ timeout: 15_000 });

    // Tab 5: Audit Log
    await page.getByTestId('settings-tab-audit-log').click();
    await expect(page.getByTestId('settings-tab-panel-audit-log').locator('table')).toBeVisible({
      timeout: 15_000,
    });

    // Tab 6: Login History
    await page.getByTestId('settings-tab-login-history').click();
    await expect(
      page.getByTestId('settings-tab-panel-login-history').locator('table'),
    ).toBeVisible({ timeout: 15_000 });

    // Tab 7: Security Dashboard (Risk Report + <progress>)
    await page.getByTestId('settings-tab-security-dashboard').click();
    await expect(page.getByTestId('security-dashboard-tab')).toBeVisible();
    await page.getByTestId('generate-risk-report-btn').click();
    await expect(page.locator('progress.hr-risk-progress')).toBeVisible({ timeout: 10_000 });

    // Tab 8: Permissions Matrix (Admin locked, Consultor toggle & restore)
    await page.getByTestId('settings-tab-permissions').click();
    await expect(page.getByTestId('permissions-manager-tab')).toBeVisible();

    await page.getByTestId('perm-role-Admin').click();
    await expect(page.getByText(/Admin possui todas as permissões bloqueadas/)).toBeVisible();
    await expect(page.getByTestId('save-permissions-btn')).toBeDisabled();

    await page.getByTestId('perm-role-Consultor').click();
    await expect(page.getByTestId('save-permissions-btn')).toBeEnabled();
    const toggleBox = page.getByTestId('perm-check-companies-update');
    await toggleBox.click();
    await page.getByTestId('save-permissions-btn').click();
    await expect(page.getByText('Permissões do perfil Consultor atualizadas com sucesso.')).toBeVisible({
      timeout: 10_000,
    });
    // Restore right away via UI
    await toggleBox.click();
    await page.getByTestId('save-permissions-btn').click();
    await expect(page.getByText('Permissões do perfil Consultor atualizadas com sucesso.')).toBeVisible({
      timeout: 10_000,
    });

    // Tab 9: Backup / Snapshot
    await page.getByTestId('settings-tab-backup').click();
    await page.getByTestId('backup-json-btn').click();
    await expect(page.getByText(/Snapshot gerado/)).toBeVisible({ timeout: 15_000 });
  });
});
