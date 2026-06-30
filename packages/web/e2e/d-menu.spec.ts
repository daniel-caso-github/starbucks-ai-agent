import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

// Helper: locate the modal heading (exact to avoid matching "Ver menú completo" quick reply)
function menuModalHeading(page: import('@playwright/test').Page) {
  return page.getByText('Menú completo', { exact: true });
}

test('D1 - pedir el menú abre el modal de menú', async ({ page }) => {
  await enviarMensaje(page, 'Ver menú completo');
  await expect(menuModalHeading(page)).toBeVisible({ timeout: 30_000 });
});

test('D2 - modal de menú muestra bebidas disponibles', async ({ page }) => {
  await enviarMensaje(page, 'Ver menú completo');
  await expect(menuModalHeading(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Caramel Frappuccino').first()).toBeVisible();
  await expect(page.getByText('Cold Brew').first()).toBeVisible();
});

test('D3 - agregar desde el menú envía mensaje y cierra modal', async ({ page }) => {
  await enviarMensaje(page, 'ver menú');
  await expect(menuModalHeading(page)).toBeVisible({ timeout: 30_000 });
  await page
    .locator('div')
    .filter({ hasText: /^Caffè Latte/ })
    .filter({ has: page.getByRole('button', { name: 'Agregar', exact: true }) })
    .getByRole('button', { name: 'Agregar', exact: true })
    .first()
    .click();
  await expect(menuModalHeading(page)).not.toBeVisible();
  await expect(page.getByText('agregar un Caffè Latte grande')).toBeVisible();
});

test('D4 - modal cierra al pulsar botón de cerrar', async ({ page }) => {
  await enviarMensaje(page, 'ver menú');
  await expect(menuModalHeading(page)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Cerrar menú').click();
  await expect(menuModalHeading(page)).not.toBeVisible();
});
