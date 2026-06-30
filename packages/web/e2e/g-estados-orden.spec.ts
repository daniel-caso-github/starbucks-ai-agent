import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

async function crearOrden(page: import('@playwright/test').Page): Promise<void> {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Caffè Latte')).toBeVisible({ timeout: 30_000 });
}

test('G1 - crear orden muestra estado Pendiente', async ({ page }) => {
  await crearOrden(page);
  await expect(page.getByText('Pendiente')).toBeVisible();
});

test('G2 - crear orden habilita botón Confirmar orden', async ({ page }) => {
  await crearOrden(page);
  await expect(page.getByRole('button', { name: 'Confirmar orden' })).toBeVisible();
});

test('G3 - confirmar orden cambia estado a Confirmada', async ({ page }) => {
  await crearOrden(page);
  await page.getByRole('button', { name: 'Confirmar orden' }).click();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('G4 - orden confirmada muestra botón de pago', async ({ page }) => {
  await crearOrden(page);
  await page.getByRole('button', { name: 'Confirmar orden' }).click();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Pagar \$/ })).toBeVisible();
});

test('G5 - pago muestra modal de éxito "¡Pago confirmado!"', async ({ page }) => {
  await crearOrden(page);
  await page.getByRole('button', { name: 'Confirmar orden' }).click();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Pagar \$/ }).click();
  await expect(page.getByText('¡Pago confirmado!')).toBeVisible({ timeout: 30_000 });
});

test('G6 - cancelar orden cambia estado a Cancelada', async ({ page }) => {
  await crearOrden(page);
  await page.getByRole('button', { name: 'Cancelar orden' }).last().click();
  await expect(page.getByText('Tu orden está vacía')).toBeVisible({ timeout: 30_000 });
});
