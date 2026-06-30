import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje, agregarDesdeTarjeta } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

async function mostrarTarjetas(page: import('@playwright/test').Page): Promise<void> {
  await enviarMensaje(page, 'buscar caramelo');
  await expect(page.getByRole('button', { name: 'Agregar a la orden' }).first()).toBeVisible({ timeout: 30_000 });
}

test('E1 - tarjeta muestra botones de tamaño', async ({ page }) => {
  await mostrarTarjetas(page);
  const card = page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: 'Agregar a la orden' }) })
    .filter({ hasText: 'Caramel Macchiato' })
    .last();
  await expect(card.getByRole('button', { name: 'Grande' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Tall' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Venti' })).toBeVisible();
});

test('E2 - tarjeta muestra opciones de leche', async ({ page }) => {
  await mostrarTarjetas(page);
  const card = page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: 'Agregar a la orden' }) })
    .filter({ hasText: 'Caramel Macchiato' })
    .last();
  await expect(card.getByRole('button', { name: 'Avena' })).toBeVisible();
});

test('E3 - tarjeta muestra opciones de jarabe', async ({ page }) => {
  await mostrarTarjetas(page);
  const card = page
    .locator('div')
    .filter({ has: page.getByRole('button', { name: 'Agregar a la orden' }) })
    .filter({ hasText: 'Caramel Macchiato' })
    .last();
  await expect(card.getByRole('button', { name: 'Vainilla' })).toBeVisible();
});

test('E4 - agregar con tamaño Tall incluye "tall" en el mensaje', async ({ page }) => {
  await mostrarTarjetas(page);
  await agregarDesdeTarjeta(page, 'Caramel Macchiato', { size: 'Tall' });
  await expect(page.getByLabel('Panel de tu orden').getByText('Caramel Macchiato')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Caramel Macchiato.*tall/i).last()).toBeVisible();
});

test('E5 - agregar con leche incluye "con leche de" en el mensaje', async ({ page }) => {
  await mostrarTarjetas(page);
  await agregarDesdeTarjeta(page, 'Caramel Macchiato', { milk: 'Avena' });
  await expect(page.getByLabel('Panel de tu orden').getByText('Caramel Macchiato')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/con leche de avena/i).last()).toBeVisible();
});

test('E6 - agregar bebida con jarabe crea orden, no devuelve cards de search (regresión)', async ({ page }) => {
  await mostrarTarjetas(page);
  await agregarDesdeTarjeta(page, 'Caramel Macchiato', { syrup: 'Caramelo' });
  const panel = page.getByLabel('Panel de tu orden');
  await expect(panel.getByText('Caramel Macchiato')).toBeVisible({ timeout: 30_000 });
});
