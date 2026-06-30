import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('L1 - segundo mensaje no falla aunque mongo se haya reseteado entre envíos', async ({ page, request }) => {
  const input = page.getByLabel('Mensaje al barista');

  // Primer mensaje — flujo normal
  await enviarMensaje(page, 'hola');
  await expect(input).toBeEnabled({ timeout: 45_000 });

  // Resetear la DB simulando un conversationId stale en el frontend
  await reiniciarEstado(request);

  // Segundo mensaje — debe responder sin mostrar el banner de error
  await enviarMensaje(page, 'hola');
  await expect(input).toBeEnabled({ timeout: 45_000 });

  await expect(page.getByText('No pude conectar con la cocina')).toHaveCount(0);
});
