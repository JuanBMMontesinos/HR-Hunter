import { test, expect } from '@playwright/test';

test.describe('E2E Smoke — HR Hunter Auth Entry & Supabase Connection', () => {
  test('redirects / to /login, verifies live Supabase health badge, and toggles PT-BR / EN-US', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    await expect(page.getByRole('heading', { name: 'Entrar no HR Hunter' })).toBeVisible();
    await expect(page.getByTestId('supabase-health-badge')).toContainText('Supabase Conectado', {
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'EN-US' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to HR Hunter' })).toBeVisible();
    await expect(page.getByTestId('supabase-health-badge')).toContainText('Supabase Connected');

    await page.getByRole('button', { name: 'PT-BR' }).click();
    await expect(page.getByRole('heading', { name: 'Entrar no HR Hunter' })).toBeVisible();
    await expect(page.getByTestId('supabase-health-badge')).toContainText('Supabase Conectado');
  });
});
