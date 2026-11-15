import { test, expect } from '@playwright/experimental-ct-react';
import { PageHeader } from '../../src/components/common/PageHeader';
import { Button } from '../../src/components/common/Button';

test.describe('PageHeader Component', () => {
  test('renders banner landmark with title, subtitle, actions, and LanguageSwitcher', async ({
    mount,
  }) => {
    const header = await mount(
      <PageHeader
        title="HR Hunter"
        subtitle="Plataforma de Recrutamento Global"
        actions={<Button variant="neutral">Ajuda</Button>}
      />,
    );

    await expect(header).toHaveRole('banner');
    await expect(header.getByText('HR Hunter')).toBeVisible();
    await expect(header.getByText('Plataforma de Recrutamento Global')).toBeVisible();
    await expect(header.getByRole('button', { name: 'Ajuda' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'PT-BR' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'EN-US' })).toBeVisible();
  });
});
