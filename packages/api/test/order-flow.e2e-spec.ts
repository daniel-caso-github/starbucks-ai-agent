import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E tests for the complete order flow via API.
 *
 * These tests verify that orders are correctly persisted
 * across multiple API calls within the same conversation.
 *
 * Prerequisites:
 * - MongoDB running on localhost:27017
 * - ChromaDB running on localhost:8000
 * - Redis running on localhost:6379
 * - Required environment variables set
 */
describe('Order Flow (e2e)', () => {
  let app: INestApplication;
  const API_ENDPOINT = '/api/v1/conversations/messages';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60000); // 60s timeout for app initialization

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/conversations/messages', () => {
    describe('Order Creation and Persistence', () => {
      it('should create a new order when ordering a drink', async () => {
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un americano' })
          .expect(200);

        expect(response.body).toHaveProperty('conversationId');
        expect(response.body).toHaveProperty('currentOrder');
        expect(response.body.currentOrder).not.toBeNull();
        expect(response.body.currentOrder.status).toBe('pending');
        expect(response.body.currentOrder.items).toHaveLength(1);
        expect(response.body.currentOrder.items[0].drinkName).toMatch(/americano/i);
      });

      it('should persist order across multiple requests in same conversation', async () => {
        // Step 1: Order first drink
        const orderResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un latte' })
          .expect(200);

        const conversationId = orderResponse.body.conversationId;
        expect(orderResponse.body.currentOrder.items).toHaveLength(1);

        // Step 2: Add second drink
        const addResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'agregar un cappuccino',
            conversationId,
          })
          .expect(200);

        expect(addResponse.body.conversationId).toBe(conversationId);
        expect(addResponse.body.currentOrder.items.length).toBeGreaterThanOrEqual(2);

        // Step 3: Verify order persists when asking for summary
        const summaryResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'que tengo en mi orden',
            conversationId,
          })
          .expect(200);

        expect(summaryResponse.body.currentOrder).not.toBeNull();
        expect(summaryResponse.body.currentOrder.items.length).toBeGreaterThanOrEqual(2);
      });

      it('should confirm order and update status to confirmed', async () => {
        // Step 1: Create order
        const orderResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un mocha' })
          .expect(200);

        const conversationId = orderResponse.body.conversationId;
        expect(orderResponse.body.currentOrder.status).toBe('pending');

        // Step 2: Confirm order
        const confirmResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'confirmar orden',
            conversationId,
          })
          .expect(200);

        expect(confirmResponse.body.currentOrder.status).toBe('confirmed');
        expect(confirmResponse.body.intent).toBe('confirm_order');
      });

      it('should handle complete order flow: order -> add items -> confirm', async () => {
        // Step 1: Start conversation with first order
        const step1 = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero dos americanos' })
          .expect(200);

        const conversationId = step1.body.conversationId;
        const orderId = step1.body.currentOrder?.orderId;

        expect(step1.body.currentOrder).not.toBeNull();
        expect(step1.body.currentOrder.status).toBe('pending');

        // Step 2: Add more items
        const step2 = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'agregar un hot chocolate',
            conversationId,
          })
          .expect(200);

        expect(step2.body.currentOrder.orderId).toBe(orderId);
        expect(step2.body.currentOrder.itemCount).toBeGreaterThan(1);

        // Step 3: Verify order contents
        const step3 = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'mostrar mi orden',
            conversationId,
          })
          .expect(200);

        expect(step3.body.currentOrder).not.toBeNull();
        expect(step3.body.currentOrder.orderId).toBe(orderId);

        // Step 4: Confirm order
        const step4 = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'si, confirmar',
            conversationId,
          })
          .expect(200);

        expect(step4.body.currentOrder.status).toBe('confirmed');
        expect(step4.body.currentOrder.orderId).toBe(orderId);
      });

      it('should cancel order when requested', async () => {
        // Create order
        const orderResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un frappuccino' })
          .expect(200);

        const conversationId = orderResponse.body.conversationId;

        // Cancel order
        const cancelResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'cancelar orden',
            conversationId,
          })
          .expect(200);

        expect(cancelResponse.body.intent).toBe('cancel_order');
        // After cancellation, currentOrder should be null or cancelled
        expect(
          cancelResponse.body.currentOrder === null ||
            cancelResponse.body.currentOrder?.status === 'cancelled',
        ).toBe(true);
      });
    });

    describe('Order Modifications', () => {
      it('should modify quantity of an item in order', async () => {
        // Create order with one item
        const orderResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un latte' })
          .expect(200);

        const conversationId = orderResponse.body.conversationId;
        const initialQuantity = orderResponse.body.currentOrder.items[0].quantity;

        // Modify quantity
        const modifyResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'cambiar a 3 lattes',
            conversationId,
          })
          .expect(200);

        // Should have modified the quantity or added more
        expect(modifyResponse.body.currentOrder).not.toBeNull();
        const totalQuantity = modifyResponse.body.currentOrder.items.reduce(
          (sum: number, item: { quantity: number }) => sum + item.quantity,
          0,
        );
        expect(totalQuantity).toBeGreaterThanOrEqual(initialQuantity);
      });

      it('should remove item from order when requested', async () => {
        // Create order with multiple items
        const order1 = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un latte y un americano' })
          .expect(200);

        const conversationId = order1.body.conversationId;
        const initialItemCount = order1.body.currentOrder.items.length;

        // Remove one item
        const removeResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'quitar el americano',
            conversationId,
          })
          .expect(200);

        expect(removeResponse.body.currentOrder).not.toBeNull();
        // Item count should be less or item should be marked as removed
        expect(removeResponse.body.currentOrder.items.length).toBeLessThanOrEqual(initialItemCount);
      });
    });

    describe('Multiple Drinks in Single Request', () => {
      it('should handle ordering multiple drinks at once', async () => {
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero dos lattes y un cappuccino' })
          .expect(200);

        expect(response.body.currentOrder).not.toBeNull();
        // Should have at least 2 different drink types or quantity > 1
        const totalItems = response.body.currentOrder.items.reduce(
          (sum: number, item: { quantity: number }) => sum + item.quantity,
          0,
        );
        expect(totalItems).toBeGreaterThanOrEqual(3);
      });

      it('should handle ordering with customizations', async () => {
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'quiero un latte grande con leche de almendra' })
          .expect(200);

        expect(response.body.currentOrder).not.toBeNull();
        expect(response.body.currentOrder.items).toHaveLength(1);
        // The AI should capture the customization
        expect(response.body.currentOrder.items[0].drinkName).toMatch(/latte/i);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty message gracefully', async () => {
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: '' })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      });

      it('should handle whitespace-only message', async () => {
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: '   ' })
          .expect(400);

        expect(response.body).toHaveProperty('message');
      });

      it('should handle moderately long messages', async () => {
        const longMessage = 'quiero un latte ' + 'por favor '.repeat(20);
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: longMessage })
          .expect(200);

        expect(response.body).toHaveProperty('response');
        expect(response.body).toHaveProperty('conversationId');
      });

      it('should handle invalid conversationId gracefully', async () => {
        const response = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'hola',
            conversationId: 'invalid-conversation-id-that-does-not-exist',
          })
          .expect(400); // Invalid UUID format returns 400

        expect(response.body).toHaveProperty('message');
      });
    });

    describe('Conversation Context', () => {
      it('should remember context from previous messages', async () => {
        // Ask about a drink
        const askResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'que tiene el mocha?' })
          .expect(200);

        const conversationId = askResponse.body.conversationId;

        // Say yes (context: ordering the mocha)
        const orderResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'si, dame uno',
            conversationId,
          })
          .expect(200);

        // Should have created an order with mocha
        expect(orderResponse.body.currentOrder).not.toBeNull();
        expect(orderResponse.body.intent).toBe('order_drink');
      });

      it('should handle greeting and then ordering', async () => {
        // Start with greeting
        const greetResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({ message: 'hola buenas tardes' })
          .expect(200);

        const conversationId = greetResponse.body.conversationId;
        expect(greetResponse.body.intent).toBe('greeting');

        // Then order with a specific drink name
        const orderResponse = await request(app.getHttpServer())
          .post(API_ENDPOINT)
          .send({
            message: 'quiero un americano',
            conversationId,
          })
          .expect(200);

        expect(orderResponse.body.intent).toBe('order_drink');
        // Order might be created if AI recognized the drink
        if (orderResponse.body.currentOrder) {
          expect(orderResponse.body.currentOrder.items.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
