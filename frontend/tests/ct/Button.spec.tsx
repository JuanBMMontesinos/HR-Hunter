import { test, expect } from '@playwright/experimental-ct-react';
import { Button } from '../../src/components/common/Button';

test.describe('Button Component', () => {
  test('renders solid variant by default and meets WCAG 44px touch target', async ({ mount }) => {
    const button = await mount(<Button>Salvar Alterações</Button>);

    await expect(button).toBeVisible();
    await expect(button).toHaveText('Salvar Alterações');
    await expect(button).toHaveAttribute('type', 'button');
    await expect(button).toHaveClass(/hr-btn--solid/);

    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('renders ghost and neutral variants and triggers click handler', async ({ mount }) => {
    let clickCount = 0;
    const ghostBtn = await mount(
      <Button
        variant="ghost"
        onClick={() => {
          clickCount += 1;
        }}
      >
        Atualizar
      </Button>,
    );

    await expect(ghostBtn).toHaveClass(/hr-btn--ghost/);
    await ghostBtn.click();
    expect(clickCount).toBe(1);

    await ghostBtn.unmount();

    const neutralBtn = await mount(<Button variant="neutral">Cancelar</Button>);
    await expect(neutralBtn).toHaveText('Cancelar');
    await expect(neutralBtn).toHaveClass(/hr-btn--neutral/);
  });

  test('respects disabled state and stays keyboard focusable when enabled', async ({
    mount,
    page,
  }) => {
    let clicked = false;
    const disabledBtn = await mount(
      <Button
        disabled
        onClick={() => {
          clicked = true;
        }}
      >
        Enviar
      </Button>,
    );

    await expect(disabledBtn).toBeDisabled();
    await disabledBtn.click({ force: true });
    expect(clicked).toBe(false);

    await disabledBtn.unmount();

    const enabledBtn = await mount(<Button>Continuar</Button>);
    await page.keyboard.press('Tab');
    await expect(enabledBtn).toBeFocused();
  });
});
