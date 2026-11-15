import { test, expect } from '@playwright/test';

test.describe('E2E Smoke — HR Hunter Foundation', () => {
  test('loads foundation page, verifies live Supabase health, and switches PT-BR / EN-US', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'HR Hunter' })).toBeVisible();
    await expect(page.getByText('Supabase Conectado')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'EN-US' }).click();
    await expect(page.getByText('Supabase Connected')).toBeVisible();
    await expect(page.getByText('Base Architecture & Supabase Connection')).toBeVisible();

    await page.getByRole('button', { name: 'PT-BR' }).click();
    await expect(page.getByText('Supabase Conectado')).toBeVisible();
  });
});
