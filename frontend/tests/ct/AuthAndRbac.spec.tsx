import { test, expect } from '@playwright/experimental-ct-react';
import {
  LoginFormHarness,
  PasswordStrengthHarness,
  RoleGuardRaceHarness,
  SidebarRbacHarness,
} from './harnesses/AuthRbacHarness';

test.describe('Phase 4 Auth & Granular RBAC Components', () => {
  test('RoleProtectedRoute avoids flash race condition while permissionsLoading is true', async ({
    mount,
  }) => {
    const component = await mount(<RoleGuardRaceHarness initialPermissionsLoading={true} />);

    // Must hold on Loader and NEVER flash "Acesso negado" before permissions resolve
    await expect(component.getByRole('status')).toContainText('Carregando...');
    await expect(component.getByText('Acesso negado')).toHaveCount(0);

    await component.getByRole('button', { name: 'Resolver sem users:read' }).click();
    await expect(component.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();
  });

  test('RoleProtectedRoute renders protected children once required permission resolves', async ({
    mount,
  }) => {
    const component = await mount(<RoleGuardRaceHarness initialPermissionsLoading={true} />);

    await component.getByRole('button', { name: 'Resolver com users:read' }).click();
    await expect(component.getByTestId('protected-users-content')).toBeVisible();
    await expect(component.getByText('Acesso negado')).toHaveCount(0);
  });

  test('LoginForm validates inputs after interaction, toggles password visibility, and surfaces 401 alert', async ({
    mount,
  }) => {
    const invalidHarness = await mount(<LoginFormHarness mode="invalid" />);
    const emailInput = invalidHarness.getByLabel(/E-mail corporativo/);
    const passwordInput = invalidHarness.getByLabel(/Senha/, { exact: false }).first();

    // Autofill compatibility attributes
    await expect(emailInput).toHaveAttribute('autocomplete', 'username');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // Submit empty triggers accessible validation messages
    await invalidHarness.getByRole('button', { name: 'Entrar' }).click();
    await expect(invalidHarness.getByText(/Informe um endereço de e-mail válido/)).toBeVisible();
    await expect(invalidHarness.getByText('A senha é obrigatória.')).toBeVisible();

    // Password reveal button updates aria-pressed & type
    const toggleBtn = invalidHarness.getByRole('button', { name: 'Mostrar senha' });
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await toggleBtn.click();
    await expect(invalidHarness.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Invalid credential error banner
    await emailInput.fill('tester@hrhunter.com');
    await passwordInput.fill('WrongPass123!');
    await invalidHarness.getByRole('button', { name: 'Entrar' }).click();
    await expect(invalidHarness.getByTestId('login-error-alert')).toContainText(
      'E-mail ou senha inválidos.',
    );
  });

  test('LoginForm surfaces 423 lockout alert when account is temporarily locked', async ({
    mount,
    page,
  }) => {
    const lockedHarness = await mount(<LoginFormHarness mode="locked" />);
    await lockedHarness.getByLabel(/E-mail corporativo/).fill('locked@hrhunter.com');
    await lockedHarness.getByLabel(/Senha/, { exact: false }).first().fill('AnyPass123!');
    await lockedHarness.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/Conta temporariamente bloqueada/).first()).toBeVisible();
  });

  test('PasswordStrengthMeter dynamically verifies all 5 complexity rules', async ({ mount }) => {
    const component = await mount(<PasswordStrengthHarness />);
    const input = component.getByLabel('Senha teste');

    await expect(component.getByText('Fraca')).toBeVisible();
    await input.fill('weak');
    await expect(component.getByText('1/5')).toBeVisible();

    await input.fill('Strong@2026!');
    await expect(component.getByText('Forte')).toBeVisible();
    await expect(component.getByText('5/5')).toBeVisible();
  });

  test('Sidebar dynamically renders only navigation items authorized by RBAC permissions', async ({
    mount,
  }) => {
    const view = await mount(
      <SidebarRbacHarness
        permissions={['dashboard:read', 'candidates:read', 'processes:read']}
      />,
    );

    const nav = view.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Candidatos' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Processos' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Meu Perfil' })).toBeVisible();

    await expect(nav.getByRole('link', { name: 'Empresas' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Configurações' })).toHaveCount(0);
  });
});
