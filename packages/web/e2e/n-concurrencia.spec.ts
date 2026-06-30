import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('N1 - doble click en QuickReply solo envía un mensaje', async ({ page }) => {
  const btn = page.getByRole('button', { name: 'Ver recomendaciones' });
  await btn.click();
  await expect(btn).toBeDisabled();
  await expect(page.getByLabel('Mensaje al barista')).toBeEnabled({ timeout: 45_000 });
  const conversation = page.getByLabel('Conversación con el barista');
  const echos = conversation.getByText('Ver recomendaciones', { exact: true });
  expect(await echos.count()).toBe(1);
});

test('N2 - botón "Agregar a la orden" de DrinkCard se deshabilita mientras procesa', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  await expect(page.getByTestId('drink-card').first()).toBeVisible({ timeout: 30_000 });
  const addBtn = page.getByTestId('drink-card').first().getByRole('button', { name: 'Agregar a la orden' });
  await addBtn.click();
  await expect(addBtn).toBeDisabled();
  await expect(page.getByLabel('Mensaje al barista')).toBeEnabled({ timeout: 45_000 });
  await expect(addBtn).toBeEnabled();
});

test('N3 - botón "Agregar" del MenuModal deja el input deshabilitado mientras procesa', async ({ page }) => {
  await enviarMensaje(page, 'ver menú completo');
  await expect(page.getByLabel('Buscar bebida')).toBeVisible({ timeout: 30_000 });
  const addBtn = page.getByTestId('menu-item').first().getByRole('button', { name: 'Agregar' });
  await addBtn.click();
  await expect(page.getByLabel('Mensaje al barista')).toBeDisabled();
  await expect(page.getByLabel('Mensaje al barista')).toBeEnabled({ timeout: 45_000 });
});

test('N4 - botones del OrderPanel se deshabilitan mientras procesa', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Americano grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Americano')).toBeVisible({ timeout: 30_000 });
  const plusBtn = page.getByLabel('Panel de tu orden').getByRole('button', { name: '+' }).first();
  await plusBtn.click();
  await expect(plusBtn).toBeDisabled();
  await expect(page.getByLabel('Mensaje al barista')).toBeEnabled({ timeout: 45_000 });
  await expect(plusBtn).toBeEnabled();
});

test('N5 - input queda deshabilitado durante typing y se libera al finalizar', async ({ page }) => {
  const input = page.getByLabel('Mensaje al barista');
  await enviarMensaje(page, 'hola');
  await expect(input).toBeDisabled();
  await expect(input).toBeEnabled({ timeout: 45_000 });
});
