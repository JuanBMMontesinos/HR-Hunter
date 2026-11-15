import { test, expect } from '@playwright/experimental-ct-react';
import {
  DataTableHarness,
  FilterAndInputsHarness,
  ModalToastHarness,
  RichTextEditorHarness,
} from './harnesses/CommonWidgetsHarness';

test.describe('Phase 4 Common Components', () => {
  test('DataTable renders semantic caption, sortable <th scope="col">, live announcement, and pagination', async ({
    mount,
  }) => {
    const component = await mount(<DataTableHarness pageSize={2} />);

    await expect(component.getByText('Candidatos em processo')).toBeVisible();
    await expect(component.getByText('Carlos Mendes')).toBeVisible();
    await expect(component.getByText('Ana Beatriz')).toBeVisible();
    await expect(component.getByText('Página 1 de 2')).toBeVisible();

    const nameSortButton = component.getByRole('button', { name: 'Candidato' });
    await nameSortButton.click();
    await expect(component.locator('th[aria-sort="ascending"]')).toHaveCount(1);
    await expect(component.getByRole('status')).toContainText('Candidato');

    await nameSortButton.click();
    await expect(component.locator('th[aria-sort="descending"]')).toHaveCount(1);

    await component.getByRole('button', { name: 'Próxima' }).click();
    await expect(component.getByText('Bruno Silva')).toBeVisible();
    await expect(component.getByText('Página 2 de 2')).toBeVisible();
  });

  test('DataTable shows skeleton rows when loading', async ({ mount }) => {
    const loadingView = await mount(<DataTableHarness loading={true} />);
    await expect(loadingView.locator('.hr-table__skeleton-row')).toHaveCount(4);
  });

  test('DataTable shows empty message when empty', async ({ mount }) => {
    const emptyView = await mount(<DataTableHarness empty={true} />);
    await expect(emptyView.getByText('Nenhum registro encontrado.')).toBeVisible();
  });

  test('Modal opens top-layer <dialog>, closes on Escape, and ToastViewport displays status notifications', async ({
    mount,
    page,
  }) => {
    const component = await mount(<ModalToastHarness />);

    await component.getByRole('button', { name: 'Abrir Modal' }).click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Confirmar ação' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await component.getByRole('button', { name: 'Disparar Toast' }).click();
    await expect(page.getByText('Registro salvo com sucesso')).toBeVisible();
  });

  test('RichTextEditor sanitizes dangerous XSS scripts and event handlers from preview', async ({
    mount,
  }) => {
    const component = await mount(<RichTextEditorHarness />);

    await component.getByRole('button', { name: '{{job_title}}' }).click();
    await expect(component.getByTestId('rich-text-sanitized-preview')).toContainText('{{job_title}}');

    const textarea = component.getByRole('textbox', { name: 'Conteúdo HTML do template' });
    await textarea.fill(
      '<p>Olá <strong>Candidato</strong></p><script>window.__xss=1</script><img src=x onerror="alert(1)">',
    );

    const preview = component.getByTestId('rich-text-sanitized-preview');
    await expect(preview.locator('strong')).toHaveText('Candidato');
    await expect(preview.locator('script')).toHaveCount(0);
    await expect(preview.locator('img[onerror]')).toHaveCount(0);
  });

  test('FilterBar, Select, and Autocomplete manage filters and keyboard selection cleanly', async ({
    mount,
  }) => {
    const component = await mount(<FilterAndInputsHarness />);

    const searchInput = component.getByRole('searchbox');
    await searchInput.fill('Curitiba');
    await expect(component.getByRole('button', { name: 'Limpar filtros' })).toBeVisible();

    await component.getByLabel('Status').selectOption('active');
    await component.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(searchInput).toHaveValue('');

    const autocomplete = component.getByRole('combobox', { name: 'Cidade' });
    await autocomplete.click();
    await autocomplete.fill('Curitiba');
    await component.getByRole('option', { name: /Curitiba/ }).dispatchEvent('mousedown');
    await expect(component.getByTestId('selected-city')).toHaveText('cwb');
  });
});
