import { test, expect } from '@playwright/test';
import { reiniciarEstado, abrirChat } from './support/helpers';

test.beforeEach(async ({ request, page }) => {
  await reiniciarEstado(request);
  await abrirChat(page);
});

test('A1 - muestra saludo inicial del barista', async ({ page }) => {
  await expect(page.getByText('¡Hola! Soy tu barista en Verde. ¿Qué te preparo hoy?')).toBeVisible();
});

test('A2 - muestra respuestas rápidas iniciales', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Ver recomendaciones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buscar una bebida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver menú completo' })).toBeVisible();
});

test('A3 - panel de orden muestra estado vacío', async ({ page }) => {
  await expect(page.getByText('Tu orden está vacía')).toBeVisible();
});

test('A4 - input tiene placeholder correcto y botón de envío', async ({ page }) => {
  await expect(page.getByLabel('Mensaje al barista')).toHaveAttribute('placeholder', 'Escríbele al barista…');
  await expect(page.getByLabel('Enviar mensaje')).toBeVisible();
});
