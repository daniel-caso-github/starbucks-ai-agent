import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Caffè Latte')).toBeVisible({ timeout: 30_000 });
});

test('F1 - panel de orden muestra botones de cantidad', async ({ page }) => {
  await expect(page.getByRole('button', { name: '−' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar' })).toBeVisible();
});

test('F2 - botón + envía "agregar otro [drink]"', async ({ page }) => {
  await page.getByRole('button', { name: '+' }).click();
  await expect(page.getByLabel('Panel de tu orden').getByText('Caffè Latte')).toBeVisible({ timeout: 30_000 });
});

test('F3 - botón − envía "quitar uno de [drink]"', async ({ page }) => {
  await page.getByRole('button', { name: '−' }).click();
  await expect(page.getByText('Tu orden está vacía')).toBeVisible({ timeout: 30_000 });
});

test('F4 - botón Quitar elimina la bebida de la orden', async ({ page }) => {
  await page.getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByText('Tu orden está vacía')).toBeVisible({ timeout: 30_000 });
});
