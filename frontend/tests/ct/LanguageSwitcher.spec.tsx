import { test, expect } from '@playwright/experimental-ct-react';
import { LanguageSwitcher } from '../../src/components/common/LanguageSwitcher';

test.describe('LanguageSwitcher Component', () => {
  test('toggles PT-BR and EN-US, persists localStorage, and updates html lang attribute', async ({
    mount,
    page,
  }) => {
    const component = await mount(<LanguageSwitcher />);
    const ptButton = component.getByRole('button', { name: 'PT-BR' });
    const enButton = component.getByRole('button', { name: 'EN-US' });

    await expect(ptButton).toHaveAttribute('aria-pressed', 'true');
    await expect(enButton).toHaveAttribute('aria-pressed', 'false');

    await enButton.click();
    await expect(enButton).toHaveAttribute('aria-pressed', 'true');
    await expect(ptButton).toHaveAttribute('aria-pressed', 'false');

    const langState = await page.evaluate(() => ({
      storage: window.localStorage.getItem('hr_hunter_lang'),
      htmlLang: document.documentElement.lang,
    }));
    expect(langState).toEqual({
      storage: 'en-US',
      htmlLang: 'en-US',
    });

    await ptButton.click();
    await expect(ptButton).toHaveAttribute('aria-pressed', 'true');
    const restored = await page.evaluate(() => ({
      storage: window.localStorage.getItem('hr_hunter_lang'),
      htmlLang: document.documentElement.lang,
    }));
    expect(restored).toEqual({
      storage: 'pt-BR',
      htmlLang: 'pt-BR',
    });
  });
});
