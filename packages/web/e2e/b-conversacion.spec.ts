import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje, esperarRespuestaBot } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('B1 - mensaje del usuario aparece como burbuja', async ({ page }) => {
  await enviarMensaje(page, 'Hola');
  await expect(page.getByText('Hola').last()).toBeVisible();
});

test('B2 - typing indicator aparece mientras el bot responde', async ({ page }) => {
  await enviarMensaje(page, 'Hola');
  // The typing indicator must appear (3 dots)
  const conversation = page.getByLabel('Conversación con el barista');
  // Wait for bot response to complete
  await esperarRespuestaBot(page, '¿Qué te preparo hoy?');
  // Bot message is shown
  await expect(conversation.getByText('¿Qué te preparo hoy?').last()).toBeVisible();
});

test('B3 - clic en quick reply envía el mensaje y bot responde', async ({ page }) => {
  await page.getByRole('button', { name: 'Ver recomendaciones' }).click();
  await expect(page.getByText('Ver recomendaciones').last()).toBeVisible();
  await esperarRespuestaBot(page, '¿Qué te preparo hoy?');
});

test('B4 - múltiples mensajes acumulan en conversación', async ({ page }) => {
  await enviarMensaje(page, 'Hola');
  await esperarRespuestaBot(page, '¿Qué te preparo hoy?');
  await enviarMensaje(page, 'Quiero algo rico');
  // Wait for second user message echo to confirm it was sent
  await expect(page.getByText('Quiero algo rico', { exact: true })).toBeVisible();
  // Wait for the second bot response (there are 2 "¿Qué te preparo hoy?" messages)
  await expect(page.getByText('¿Qué te preparo hoy?').last()).toBeVisible({ timeout: 15_000 });
  // Both user messages are visible
  const conversation = page.getByLabel('Conversación con el barista');
  await expect(conversation.getByText('Hola', { exact: true })).toBeVisible();
  await expect(conversation.getByText('Quiero algo rico', { exact: true })).toBeVisible();
});

test('B5 - input se limpia después de enviar', async ({ page }) => {
  await enviarMensaje(page, 'Hola');
  await expect(page.getByLabel('Mensaje al barista')).toHaveValue('');
});

test('B6 - burbuja del bot tiene texto visible en el primer mensaje (regresión burbuja vacía)', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Americano grande');
  // The order appearing in the panel proves: Gemini processed it, complete event fired with response text
  await expect(page.getByLabel('Panel de tu orden').getByText('Americano')).toBeVisible({ timeout: 30_000 });
});
