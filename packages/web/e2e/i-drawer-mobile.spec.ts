import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

// Mobile viewport for these tests
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
  await page.getByRole('button', { name: 'Mobile' }).click();
});

test('I1 - en móvil el panel de orden es un drawer deslizable', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByText('Ver tu orden')).toBeVisible({ timeout: 30_000 });
});

test('I2 - clic en peek abre el drawer de orden', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByText('Ver tu orden')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Ver tu orden').click();
  await expect(page.getByText('Tu orden', { exact: true })).toBeVisible();
  await expect(page.getByText('Caffè Latte', { exact: true })).toBeVisible();
});

test('I3 - drawer cierra con botón ✕', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByText('Ver tu orden')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Ver tu orden').click();
  await expect(page.getByLabel('Cerrar panel de orden')).toBeVisible();
  await page.getByLabel('Cerrar panel de orden').click();
  await expect(page.getByLabel('Mensaje al barista')).toBeVisible();
});
