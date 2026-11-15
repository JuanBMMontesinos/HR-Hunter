import { test, expect } from '@playwright/test';
import bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createDbPool } = require('../../database/scripts/db');

test.describe('E2E — Phase 5 CRUDs, Optional CPF, CSV Import, Kanban Pipeline & Profile', () => {
  const pool = createDbPool();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const prefix = `pw5-${suffix}`;
  const adminEmail = `${prefix}-admin@example.com`;
  const password = `Pw5Crud#${suffix}!`;
  let adminUserId: number;

  const companyName = `Empresa ${prefix} Ltda`;
  const digits = String(Date.now()).replace(/\D/g, '').slice(-8);
  const companyCnpj = `88.${digits.slice(0, 3)}.${digits.slice(3, 6)}/0001-55`;
  const jobTitle = `Engenheiro ${prefix}`;
  const candidateName = `Candidato ${prefix}`;
  const candidateEmail = `${prefix}-cand@example.com`;
  const csvEmail = `${prefix}-csv@example.com`;
  const subUserEmail = `${prefix}-rec@example.com`;

  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department, is_active)
       VALUES ($1, $2, 'PW5 CRUD Admin', 'Admin', 'Talent Acquisition', TRUE)
       RETURNING id`,
      [adminEmail, hash],
    );
    adminUserId = Number(res.rows[0].id);
  });

  test.afterAll(async () => {
    // Clean up all Phase 5 E2E entities respecting FK dependencies
    await pool.query(
      `DELETE FROM offers WHERE process_id IN (
         SELECT rp.id FROM recruitment_processes rp
         JOIN candidates c ON c.id = rp.candidate_id
         WHERE c.email = ANY($1::text[])
       )`,
      [[candidateEmail, csvEmail]],
    );
    await pool.query(
      `DELETE FROM process_stages WHERE process_id IN (
         SELECT rp.id FROM recruitment_processes rp
         JOIN candidates c ON c.id = rp.candidate_id
         WHERE c.email = ANY($1::text[])
       )`,
      [[candidateEmail, csvEmail]],
    );
    await pool.query(
      `DELETE FROM recruitment_processes WHERE candidate_id IN (
         SELECT id FROM candidates WHERE email = ANY($1::text[])
       )`,
      [[candidateEmail, csvEmail]],
    );
    await pool.query(`DELETE FROM job_openings WHERE title LIKE $1`, [`%${prefix}%`]);
    await pool.query(`DELETE FROM companies WHERE legal_name = $1`, [companyName]);
    await pool.query(
      `DELETE FROM candidate_skills WHERE candidate_id IN (
         SELECT id FROM candidates WHERE email = ANY($1::text[])
       )`,
      [[candidateEmail, csvEmail]],
    );
    await pool.query(
      `DELETE FROM candidates WHERE email = ANY($1::text[])`,
      [[candidateEmail, csvEmail]],
    );

    const userIdsRes = await pool.query(
      `SELECT id FROM users WHERE email = ANY($1::text[])`,
      [[adminEmail, subUserEmail]],
    );
    const ids = userIdsRes.rows.map((r: { id: number }) => Number(r.id));
    if (ids.length > 0) {
      await pool.query(`DELETE FROM notifications WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM refresh_tokens WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(`DELETE FROM audit_log WHERE user_id = ANY($1::bigint[])`, [ids]);
      await pool.query(
        `DELETE FROM login_history WHERE user_id = ANY($1::bigint[]) OR email_attempted = ANY($2::text[])`,
        [ids, [adminEmail, subUserEmail]],
      );
      await pool.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [ids]);
    } else if (adminUserId) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [adminUserId]);
    }
    await pool.end();
  });

  test('executes full end-to-end recruitment journey via UI: Company -> Job -> Candidate (optional CPF + CSV) -> Kanban -> Offer -> Users & Profile', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // 1. Login
    await page.goto('/login');
    await page.getByLabel(/E-mail corporativo/).fill(adminEmail);
    await page.getByLabel('Senha', { exact: false }).first().fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    // 2. Companies CRUD
    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Empresas' }).click();
    await expect(page.getByTestId('companies-page')).toBeVisible();

    await page.getByTestId('new-company-btn').click();
    const companyDialog = page.locator('dialog[open]');
    await companyDialog.getByLabel(/Razão Social/).fill(companyName);
    await companyDialog.getByLabel(/CNPJ/).fill(companyCnpj);
    await companyDialog.getByLabel(/Setor/).fill('Tecnologia');
    await companyDialog.getByLabel(/Cidade/).fill('São Paulo');
    await companyDialog.getByTestId('company-save-btn').click();

    await expect(page.getByText('Empresa cadastrada com sucesso.')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('searchbox').fill(prefix);
    await expect(page.getByRole('table')).toContainText(companyName);

    // 3. Job Openings CRUD
    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Vagas' }).click();
    await expect(page.getByTestId('job-openings-page')).toBeVisible();

    await page.getByTestId('new-job-btn').click();
    const jobDialog = page.locator('dialog[open]');
    const compInput = jobDialog.getByRole('combobox', { name: /Empresa/ });
    await compInput.click();
    await compInput.fill(prefix);
    await jobDialog.getByRole('option', { name: new RegExp(companyName) }).click();
    await jobDialog.getByLabel(/Título da Vaga/).fill(jobTitle);
    await jobDialog.getByLabel(/Departamento/).fill('Engenharia');
    await jobDialog.getByTestId('job-save-btn').click();

    await expect(page.getByText('Vaga criada com sucesso.')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('searchbox').fill(prefix);
    await expect(page.getByRole('table')).toContainText(jobTitle);

    // 4. Candidates CRUD (CPF optional) + CSV Bulk Import
    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Candidatos' }).click();
    await expect(page.getByTestId('candidates-page')).toBeVisible();

    await page.getByTestId('new-candidate-btn').click();
    const candDialog = page.locator('dialog[open]');
    await candDialog.getByLabel(/Nome Completo/).fill(candidateName);
    await candDialog.getByLabel(/^E-mail/).fill(candidateEmail);
    await candDialog.getByLabel(/Telefone/).fill('11988887777');
    // Deliberately leave CPF empty to prove optional CPF rule
    await candDialog.getByTestId('cand-form-tab-skills').click();
    await candDialog.getByRole('textbox', { name: 'Competência', exact: true }).fill('Playwright');
    await candDialog.getByRole('button', { name: 'Adicionar Competência' }).click();
    await candDialog.getByTestId('candidate-save-btn').click();

    await expect(page.getByText('Candidato cadastrado com sucesso.')).toBeVisible({ timeout: 10_000 });

    // CSV Import
    await page.getByTestId('import-csv-btn').click();
    const importDialog = page.locator('dialog[open]');
    await importDialog
      .getByLabel(/Ou cole o conteúdo CSV/)
      .fill(`full_name,email,city,state,skills\nCSV ${prefix},${csvEmail},Curitiba,PR,Node.js;SQL`);
    await importDialog.getByTestId('csv-import-submit').click();
    await expect(importDialog.getByTestId('csv-import-result')).toContainText('1 importados');
    await importDialog.getByRole('button', { name: 'Fechar' }).last().click();

    await page.getByRole('searchbox').fill(prefix);
    await expect(page.getByRole('table')).toContainText(candidateName);
    await expect(page.getByRole('table')).toContainText(csvEmail);

    // 5. Processes Kanban -> Move -> Evaluate -> Offer -> Hire -> Timeline
    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Processos' }).click();
    await expect(page.getByTestId('processes-page')).toBeVisible();
    await expect(page.getByTestId('processes-kanban')).toBeVisible();

    await page.getByTestId('new-process-btn').click();
    const procCreateDialog = page.locator('dialog[open]');
    await procCreateDialog.getByLabel(/^Vaga/).selectOption({ label: `${jobTitle} — ${companyName}` });
    await procCreateDialog
      .getByLabel(/^Candidato/)
      .selectOption({ label: `${candidateName} (${candidateEmail})` });
    await procCreateDialog.getByTestId('create-process-submit').click();

    await expect(page.getByText('Processo seletivo iniciado com sucesso.')).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('searchbox').fill(prefix);
    const card = page.locator('[data-testid^="kanban-card-"]', { hasText: candidateName }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const cardTestId = await card.getAttribute('data-testid');
    const processId = Number((cardTestId || '').replace('kanban-card-', ''));
    expect(processId).toBeGreaterThan(0);

    // Accessible step move next button
    await page.getByTestId(`kanban-next-${processId}`).click();
    await expect(page.getByTestId('kanban-live-region')).toContainText(candidateName, {
      timeout: 10_000,
    });

    // Open Process Detail Modal -> Evaluate 5 stars -> Offer -> Hire -> Timeline
    await page.getByTestId(`kanban-detail-btn-${processId}`).click();
    const detailDialog = page.locator('dialog[open]');
    await expect(detailDialog).toBeVisible();

    await detailDialog.getByTestId('star-rating-5').click();
    await detailDialog.getByLabel(/Feedback da Etapa/).fill('Excelente domínio técnico');
    await detailDialog.getByTestId('advance-stage-submit').click();
    await expect(page.getByText('Processo atualizado com sucesso.')).toBeVisible({ timeout: 10_000 });

    await detailDialog.getByTestId('process-detail-tab-offer').click();
    await detailDialog.getByLabel(/Salário Proposto/).fill('14500');
    await detailDialog.getByTestId('send-offer-submit').click();
    await expect(page.getByText('Proposta registrada e processo movido para Oferta.')).toBeVisible({
      timeout: 10_000,
    });

    const acceptOfferBtn = detailDialog.locator('[data-testid^="accept-offer-"]').first();
    await expect(acceptOfferBtn).toBeVisible();
    await acceptOfferBtn.click();
    await expect(page.getByText('Status da proposta atualizado.')).toBeVisible({ timeout: 10_000 });

    await detailDialog.getByTestId('process-detail-tab-timeline').click();
    await expect(detailDialog.getByTestId('process-timeline-list')).toContainText('Proposta');
    await detailDialog.getByRole('button', { name: 'Fechar' }).last().click();

    // 6. Users & Profile
    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Usuários' }).click();
    await expect(page.getByTestId('users-page')).toBeVisible();
    await page.getByTestId('new-user-btn').click();
    const userDialog = page.locator('dialog[open]');
    await userDialog.getByLabel(/Nome Completo/).fill(`Recrutador ${prefix}`);
    await userDialog.getByLabel(/^E-mail/).fill(subUserEmail);
    await userDialog.getByLabel(/Senha Inicial/).fill(password);
    await userDialog.getByTestId('user-save-btn').click();
    await expect(page.getByText('Usuário criado com sucesso.')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('desktop-sidebar').getByRole('link', { name: 'Meu Perfil' }).click();
    await expect(page.getByTestId('profile-page')).toBeVisible();
    await page.getByLabel(/Nome Completo/).fill(`Admin Atualizado ${prefix}`);
    await page.getByTestId('profile-save-btn').click();
    await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible({ timeout: 10_000 });
  });
});
