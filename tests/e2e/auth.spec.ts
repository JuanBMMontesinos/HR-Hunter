import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hashToken } = require('../../backend/utils/tokenUtils');

test.describe('E2E — Authentication, HttpOnly Cookie Persistence & Granular RBAC', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const recruiterEmail = `pw4-e2e-recruiter-${suffix}@example.com`;
  const initialPassword = `Init#E2E${suffix}!`;
  const resetPassword = `Reset#E2E${suffix}!`;
  let recruiterUserId: number;

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(initialPassword, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'Playwright E2E Recruiter', 'Recrutador', 'Talent Acquisition', TRUE)
       RETURNING id`,
      [recruiterEmail, hash],
    );
    recruiterUserId = Number(result.rows[0].id);
  });

  test.afterAll(async () => {
    if (recruiterUserId) {
      await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [recruiterUserId]);
      await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [recruiterUserId]);
      await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [recruiterUserId]);
      await pool.query(`DELETE FROM security_alerts WHERE user_id = $1`, [recruiterUserId]);
      await pool.query(`DELETE FROM audit_log WHERE user_id = $1`, [recruiterUserId]);
      await pool.query(
        `DELETE FROM login_history WHERE user_id = $1 OR email_attempted = $2`,
        [recruiterUserId, recruiterEmail],
      );
      await pool.query(`DELETE FROM users WHERE id = $1`, [recruiterUserId]);
    }
    await pool.end();
  });

  test('shows error alert on invalid credentials without leaving login page', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/E-mail corporativo/).fill(recruiterEmail);
    await page.getByLabel('Senha', { exact: false }).first().fill('WrongPassword@999');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByTestId('login-error-alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logs in as Recrutador, filters sidebar by RBAC, denies /users, persists across reload, and logs out', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel(/E-mail corporativo/).fill(recruiterEmail);
    await page.getByLabel('Senha', { exact: false }).first().fill(initialPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

    // Sidebar displays authorized modules for Recrutador and omits Admin-only routes
    const sidebar = page.getByTestId('desktop-sidebar');
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Empresas' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Vagas' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Candidatos' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Processos' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Meu Perfil' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Configurações' })).toHaveCount(0);

    // Reload must preserve session via HttpOnly refresh cookie without redirecting to /login
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

    // Direct navigation to restricted /users route resolves to /access-denied
    await page.goto('/users');
    await expect(page).toHaveURL(/\/access-denied$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();

    // Navigate back to dashboard and sign out via user menu
    await page.getByRole('link', { name: 'Ir para o início' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();

    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  });

  test('completes forgot-password flow and resets password via token UI, then logs in with new password', async ({
    page,
  }) => {
    // Request password recovery via UI
    await page.goto('/forgot-password');
    await page.getByLabel(/E-mail corporativo/).fill(recruiterEmail);
    await page.getByRole('button', { name: 'Enviar instruções' }).click();
    await expect(page.getByRole('status')).toContainText('redefinir sua senha', { timeout: 10_000 });

    // Create deterministic reset token directly for UI reset-password test (no email server in dev)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [recruiterUserId, tokenHash, expiresAt],
    );

    await page.goto(`/reset-password?token=${rawToken}`);
    await page.getByLabel('Nova senha', { exact: false }).first().fill(resetPassword);
    await page.getByLabel('Confirmar nova senha', { exact: false }).first().fill(resetPassword);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();

    await expect(page.getByRole('status')).toContainText('Senha redefinida com sucesso', {
      timeout: 10_000,
    });

    await page.getByRole('link', { name: 'Voltar para o login' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Log in with the newly set password
    await page.getByLabel(/E-mail corporativo/).fill(recruiterEmail);
    await page.getByLabel('Senha', { exact: false }).first().fill(resetPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });
});
