import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('H1 - reiniciar conversación desde nueva orden limpia el chat', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Caffè Latte')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Confirmar orden' }).click();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Pagar \$/ }).click();
  await expect(page.getByText('¡Pago confirmado!')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Hacer otro pedido' }).click();
  await expect(page.getByText('Tu orden está vacía')).toBeVisible();
});

test('H2 - endpoint de reset limpia estado del servidor', async ({ request, page }) => {
  await enviarMensaje(page, 'Quiero un Cold Brew grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Cold Brew')).toBeVisible({ timeout: 30_000 });
  await reiniciarEstado(request);
  await page.reload();
  await expect(page.getByText('¿Qué te preparo hoy?')).toBeVisible({ timeout: 30_000 });
});

test('H3 - quick reply Cancelar orden aparece al tener orden pendiente', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Cold Brew grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Cold Brew')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Confirmar mi orden' })).toBeVisible();
  await expect(page.getByLabel('Conversación con el barista').getByRole('button', { name: 'Cancelar orden' })).toBeVisible();
});

test('H4 - quick reply "Agregar otra bebida" aparece y muestra drinks al hacer click', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Cold Brew grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Cold Brew')).toBeVisible({ timeout: 30_000 });

  const chat = page.getByLabel('Conversación con el barista');
  const btn = chat.getByRole('button', { name: 'Agregar otra bebida' });
  await expect(btn).toBeVisible();

  await btn.click();
  await expect(chat.getByText('Caffè Latte').last()).toBeVisible({ timeout: 30_000 });
});
