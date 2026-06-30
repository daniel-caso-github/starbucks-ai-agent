import { test, expect, type Page } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

async function abrirMenu(page: Page): Promise<void> {
  await enviarMensaje(page, 'ver menú completo');
  await expect(page.getByLabel('Buscar bebida')).toBeVisible({ timeout: 30_000 });
}

test('M1 - menú muestra imagen real de cada bebida', async ({ page }) => {
  await abrirMenu(page);
  const imgs = page.getByTestId('menu-item').locator('img');
  const count = await imgs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(count, 5); i++) {
    const src = await imgs.nth(i).getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/^https?:\/\//);
  }
});

test('M2 - search filtra el menú por nombre', async ({ page }) => {
  await abrirMenu(page);
  await page.getByLabel('Buscar bebida').fill('latte');
  const items = page.getByTestId('menu-item');
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const text = (await items.nth(i).innerText()).toLowerCase();
    expect(text).toContain('latte');
  }
});

test('M3 - toggle "Caliente" oculta bebidas frías', async ({ page }) => {
  await abrirMenu(page);
  await page.getByTestId('menu-temp-filter-hot').click();
  await expect(page.getByText('Frío', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('menu-item').first()).toBeVisible();
});

test('M4 - empty state cuando search no encuentra nada', async ({ page }) => {
  await abrirMenu(page);
  await page.getByLabel('Buscar bebida').fill('xyznoexiste123');
  await expect(page.getByTestId('menu-empty')).toBeVisible();
});
