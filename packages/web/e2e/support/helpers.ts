import type { Page, APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

const API_RESET = 'http://localhost:3000/api/v1/test/reset';

export async function reiniciarEstado(request: APIRequestContext): Promise<void> {
  await request.post(API_RESET);
}

export async function abrirChat(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('¿Qué te preparo hoy?')).toBeVisible({ timeout: 45_000 });
}

export async function enviarMensaje(page: Page, texto: string): Promise<void> {
  const input = page.getByLabel('Mensaje al barista');
  await input.fill(texto);
  await input.press('Enter');
}

export async function esperarRespuestaBot(page: Page, textoFinal: string): Promise<void> {
  await expect(page.getByText(textoFinal, { exact: false }).last()).toBeVisible({ timeout: 45_000 });
}

export async function agregarDesdeTarjeta(
  page: Page,
  nombreBebida: string,
  opts?: { size?: 'Tall' | 'Grande' | 'Venti'; milk?: string; syrup?: string },
): Promise<void> {
  const card = page
    .getByTestId('drink-card')
    .filter({ hasText: nombreBebida })
    .first();

  if (opts?.size) {
    await card.getByRole('button', { name: opts.size }).click();
  }
  if (opts?.milk) {
    await card.getByRole('button', { name: opts.milk }).click();
  }
  if (opts?.syrup) {
    await card.getByRole('button', { name: opts.syrup }).click();
  }
  await card.getByRole('button', { name: 'Agregar a la orden' }).click();
}
