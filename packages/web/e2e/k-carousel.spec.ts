import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat, enviarMensaje } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('K1 - carousel muestra flechas de navegación cuando hay drinks', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  const carousel = page.getByLabel('Carrusel de bebidas');
  await expect(carousel).toBeVisible({ timeout: 30_000 });
  await expect(carousel.getByRole('button', { name: 'Bebida anterior' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: 'Siguiente bebida' })).toBeVisible();
});

test('K2 - flecha "Siguiente" avanza el carousel y habilita "Anterior"', async ({ page }) => {
  await enviarMensaje(page, 'buscar caramelo');
  const carousel = page.getByLabel('Carrusel de bebidas');
  await expect(carousel).toBeVisible({ timeout: 30_000 });
  const prev = carousel.getByRole('button', { name: 'Bebida anterior' });
  const next = carousel.getByRole('button', { name: 'Siguiente bebida' });

  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(prev).toBeEnabled();
});

test('K3 - todas las cards visibles tienen la misma altura', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  const firstCard = page.getByTestId('drink-card').first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  const cards = await page.getByTestId('drink-card').all();
  expect(cards.length).toBeGreaterThanOrEqual(2);
  const heights = await Promise.all(cards.map(async (c) => (await c.boundingBox())?.height ?? 0));
  const max = Math.max(...heights);
  const min = Math.min(...heights);
  expect(max - min).toBeLessThanOrEqual(1);
});

test('K4 - cada card renderiza una imagen con src no-vacío', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  await expect(page.getByTestId('drink-card').first()).toBeVisible({ timeout: 30_000 });
  const imgs = page.getByTestId('drink-card').locator('img');
  const count = await imgs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const src = await imgs.nth(i).getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/^https?:\/\//);
  }
});

test('K6 - search del carrusel filtra las cards visibles', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  await expect(page.getByTestId('drink-card').first()).toBeVisible({ timeout: 30_000 });
  const before = await page.getByTestId('drink-card').count();
  await page.getByLabel('Filtrar bebidas del carrusel').first().fill('latte');
  const after = await page.getByTestId('drink-card').count();
  expect(after).toBeLessThanOrEqual(before);
  const visible = page.getByTestId('drink-card');
  const n = await visible.count();
  for (let i = 0; i < n; i++) {
    const text = (await visible.nth(i).innerText()).toLowerCase();
    expect(text).toContain('latte');
  }
});

test('K7 - toggle "Frío" en el carrusel oculta bebidas calientes', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  await expect(page.getByTestId('drink-card').first()).toBeVisible({ timeout: 30_000 });
  const carousel = page.getByLabel('Carrusel de bebidas');
  await page.getByLabel('Carrusel de bebidas').evaluate((el) => el.scrollIntoView());
  await carousel.getByRole('button', { name: 'Frío' }).click();
  await expect(carousel.getByText('Caliente', { exact: true })).toHaveCount(0);
});

test('K5 - el carousel no navega por drag, solo por flechas', async ({ page }) => {
  await enviarMensaje(page, 'Ver recomendaciones');
  const firstCard = page.getByTestId('drink-card').first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });
  const before = await firstCard.boundingBox();

  await page.mouse.move(before!.x + 100, before!.y + 50);
  await page.mouse.down();
  await page.mouse.move(before!.x - 200, before!.y + 50, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const afterDrag = await firstCard.boundingBox();
  expect(Math.abs(afterDrag!.x - before!.x)).toBeLessThan(5);

  const next = page.getByLabel('Carrusel de bebidas').getByRole('button', { name: 'Siguiente bebida' });
  await next.click();
  await page.waitForTimeout(400);

  const afterClick = await firstCard.boundingBox();
  expect(afterClick!.x).toBeLessThan(before!.x - 50);
});
