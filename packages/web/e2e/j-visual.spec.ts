import { test, expect, type Page } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

const HOT_COLOR = 'rgb(176, 137, 104)';
const COLD_COLOR = 'rgb(91, 138, 158)';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

async function getThumbStyle(page: Page, itemName: string): Promise<string> {
  const panel = page.getByLabel('Panel de tu orden');
  const nameSpan = panel.getByText(itemName, { exact: true });
  const row = nameSpan.locator('xpath=ancestor::div[contains(@class,"border-b")][1]');
  return (await row.locator('div').first().getAttribute('style')) ?? '';
}

test('J1 - bebida caliente (Caffè Latte) muestra thumb marrón en el panel', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Caffè Latte')).toBeVisible({ timeout: 30_000 });
  const style = await getThumbStyle(page, 'Caffè Latte');
  expect(style.toLowerCase()).toContain(HOT_COLOR);
});

test('J2 - bebida fría (Cold Brew) muestra thumb azul en el panel', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Cold Brew grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Cold Brew')).toBeVisible({ timeout: 30_000 });
  const style = await getThumbStyle(page, 'Cold Brew');
  expect(style.toLowerCase()).toContain(COLD_COLOR);
});

test('J3 - hot y cold conviven con colores distintos en el panel', async ({ page }) => {
  await enviarMensaje(page, 'Quiero un Caffè Latte grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Caffè Latte')).toBeVisible({ timeout: 30_000 });
  await enviarMensaje(page, 'Quiero un Cold Brew grande');
  await expect(page.getByLabel('Panel de tu orden').getByText('Cold Brew')).toBeVisible({ timeout: 30_000 });
  const hotStyle = (await getThumbStyle(page, 'Caffè Latte')).toLowerCase();
  const coldStyle = (await getThumbStyle(page, 'Cold Brew')).toLowerCase();
  expect(hotStyle).toContain(HOT_COLOR);
  expect(coldStyle).toContain(COLD_COLOR);
});
