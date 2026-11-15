import { test, expect } from '@playwright/experimental-ct-react';
import {
  ConfirmAndProgressHarness,
  DashboardWidgetsHarness,
  KanbanHarness,
  TabsHarness,
} from './harnesses/Phase5WidgetsHarness';

test.describe('Phase 5 Components — Tabs, Dashboard Widgets & Kanban', () => {
  test('Tabs follow WAI-ARIA pattern (no aria-controls, hidden inactive panels, ArrowRight/Enter keyboard nav)', async ({
    mount,
  }) => {
    const view = await mount(<TabsHarness selectionMode="activation" />);

    const tab1 = view.getByTestId('ct-tab-one');
    const tab2 = view.getByTestId('ct-tab-two');
    await expect(tab1).toHaveAttribute('aria-selected', 'true');
    await expect(tab1).not.toHaveAttribute('aria-controls');
    await expect(view.getByTestId('ct-tab-panel-two')).toBeHidden();

    await tab1.focus();
    await view.page().keyboard.press('ArrowRight');
    await expect(tab2).toBeFocused();
    // Selection by activation does not switch until Enter/Space/Click
    await expect(tab1).toHaveAttribute('aria-selected', 'true');

    await view.page().keyboard.press('Enter');
    await expect(tab2).toHaveAttribute('aria-selected', 'true');
    await expect(view.getByText('Conteúdo da Aba 2')).toBeVisible();
    await expect(view.getByTestId('ct-tab-panel-one')).toBeHidden();
  });

  test('Dashboard widgets render KPI, SVG charts, accessible Table toggle, and Critical Processes', async ({
    mount,
  }) => {
    const view = await mount(<DashboardWidgetsHarness />);

    await expect(view.getByTestId('ct-kpi-jobs')).toContainText('9');
    await expect(view.getByTestId('chart-by-stage')).toContainText('Triagem CV');
    await expect(view.getByTestId('chart-jobs-status').getByRole('img')).toBeVisible();

    await view.getByTestId('chart-by-stage-toggle').click();
    await expect(view.getByTestId('chart-by-stage').locator('table')).toBeVisible();

    await expect(view.getByTestId('critical-processes-card')).toContainText('Tech Lead Node.js');
    await expect(view.getByTestId('critical-processes-card')).toContainText('36d');
  });

  test('ProcessKanban moves candidate card between columns via accessible button and updates live region', async ({
    mount,
  }) => {
    const view = await mount(<KanbanHarness />);

    const col1 = view.getByTestId('kanban-col-1');
    const col2 = view.getByTestId('kanban-col-2');
    await expect(col1).toContainText('Mariana Souza');
    await expect(col2).not.toContainText('Mariana Souza');

    await view.getByTestId('kanban-next-901').click();
    await expect(col1).not.toContainText('Mariana Souza');
    await expect(col2).toContainText('Mariana Souza');
    await expect(view.getByTestId('kanban-live-region')).toContainText(
      'Processo de Mariana Souza movido para Entrevista Técnica.',
    );
  });

  test('ConfirmModal and native <progress> risk meter render and interact accessibly', async ({
    mount,
    page,
  }) => {
    const view = await mount(<ConfirmAndProgressHarness />);

    const bar = view.getByRole('progressbar', { name: 'Pontuação de Risco' });
    await expect(bar).toHaveAttribute('value', '62');
    await expect(bar).toHaveAttribute('max', '100');

    await view.getByRole('button', { name: 'Solicitar Confirmação' }).click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.getByTestId('confirm-modal-submit').click();
    await expect(view.getByTestId('confirm-result')).toHaveText('Confirmado');
  });
});
