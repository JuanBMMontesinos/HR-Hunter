import { test, expect } from '@playwright/experimental-ct-react';
import { StatusBadge } from '../../src/components/common/StatusBadge';

test.describe('StatusBadge Component', () => {
  test('renders semantic variants with accessible text', async ({ mount }) => {
    const success = await mount(
      <StatusBadge status="success" label="Supabase Conectado" testId="badge-success" />,
    );
    await expect(success).toContainText('Supabase Conectado');
    await expect(success).toHaveClass(/hr-badge--success/);
    await success.unmount();

    const warning = await mount(<StatusBadge status="warning" label="Pendente" />);
    await expect(warning).toContainText('Pendente');
    await expect(warning).toHaveClass(/hr-badge--warning/);
    await warning.unmount();

    const danger = await mount(<StatusBadge status="danger" label="Banco Indisponível" />);
    await expect(danger).toContainText('Banco Indisponível');
    await expect(danger).toHaveClass(/hr-badge--danger/);
    await danger.unmount();

    const neutral = await mount(<StatusBadge status="neutral" label="Inativo" />);
    await expect(neutral).toContainText('Inativo');
    await expect(neutral).toHaveClass(/hr-badge--neutral/);
  });
});
