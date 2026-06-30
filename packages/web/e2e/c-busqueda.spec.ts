import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('C1 - buscar caramelo muestra respuesta y tarjetas de bebidas', async ({ page }) => {
  await enviarMensaje(page, 'Buscar bebidas de caramelo');
  await expect(page.getByRole('button', { name: 'Agregar a la orden' }).first()).toBeVisible({ timeout: 30_000 });
});

test('C2 - tarjetas de búsqueda incluyen Caramel Macchiato', async ({ page }) => {
  await enviarMensaje(page, 'buscar caramelo');
  await expect(page.getByText('Caramel Macchiato', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});

test('C3 - buscar frío muestra bebidas heladas', async ({ page }) => {
  await enviarMensaje(page, 'Quiero algo frío');
  await expect(page.getByRole('button', { name: 'Agregar a la orden' }).first()).toBeVisible({ timeout: 30_000 });
});
