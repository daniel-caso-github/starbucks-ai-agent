import { OrderMapper } from '@infrastructure/adapters/persistence/mongodb/mappers';
import {
  CustomizationsDocument,
  OrderDocument,
  OrderItemDocument,
} from '@infrastructure/adapters/persistence/mongodb/schemas';
import { Order } from '@domain/entities';
import { DrinkId, DrinkSize, Money, OrderId, OrderItem } from '@domain/value-objects';

describe('OrderMapper', () => {
  const createCustomizationsDocument = (
    overrides: Partial<{
      milk: string;
      syrup: string;
      sweetener: string;
      topping: string;
    }> = {},
  ): CustomizationsDocument => {
    const doc = new CustomizationsDocument();
    doc.milk = overrides.milk;
    doc.syrup = overrides.syrup;
    doc.sweetener = overrides.sweetener;
    doc.topping = overrides.topping;
    return doc;
  };

  const createOrderItemDocument = (
    overrides: Partial<{
      drinkId: string;
      drinkName: string;
      size: string | null;
      quantity: number;
      unitPriceCents: number;
      currency: string;
      customizations: CustomizationsDocument;
    }> = {},
  ): OrderItemDocument => {
    const doc = new OrderItemDocument();
    doc.drinkId = overrides.drinkId ?? 'drk_test-123';
    doc.drinkName = overrides.drinkName ?? 'Test Latte';
    doc.size = 'size' in overrides ? overrides.size! : 'grande';
    doc.quantity = overrides.quantity ?? 1;
    doc.unitPriceCents = overrides.unitPriceCents ?? 500;
    doc.currency = overrides.currency ?? 'USD';
    doc.customizations = overrides.customizations ?? createCustomizationsDocument();
    return doc;
  };

  const createOrderDocument = (
    overrides: Partial<{
      id: string;
      status: string;
      items: OrderItemDocument[];
      conversationId: string;
      createdAt: Date;
      updatedAt: Date;
    }> = {},
  ): OrderDocument => {
    const doc = new OrderDocument();
    doc._id = overrides.id ?? 'ord_test-123';
    doc.status = overrides.status ?? 'pending';
    doc.items = overrides.items ?? [];
    doc.conversationId = overrides.conversationId ?? 'conv_test-123';
    doc.createdAt = overrides.createdAt ?? new Date('2024-01-01');
    doc.updatedAt = overrides.updatedAt ?? new Date('2024-01-02');
    return doc;
  };

  describe('toDomain', () => {
    it('should convert document to domain entity', () => {
      // Arrange
      const document = createOrderDocument({
        id: 'ord_abc123',
        status: 'pending',
        createdAt: new Date('2024-01-01'),
      });

      // Act
      const order = OrderMapper.toDomain(document);

      // Assert
      expect(order).toBeInstanceOf(Order);
      expect(order.id.toString()).toBe('ord_abc123');
      expect(order.status.isPending()).toBe(true);
      expect(order.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should convert order status correctly', () => {
      // Test pending
      let document = createOrderDocument({ status: 'pending' });
      expect(OrderMapper.toDomain(document).status.isPending()).toBe(true);

      // Test confirmed
      document = createOrderDocument({ status: 'confirmed' });
      expect(OrderMapper.toDomain(document).status.isConfirmed()).toBe(true);

      // Test completed
      document = createOrderDocument({ status: 'completed' });
      expect(OrderMapper.toDomain(document).status.isCompleted()).toBe(true);

      // Test cancelled
      document = createOrderDocument({ status: 'cancelled' });
      expect(OrderMapper.toDomain(document).status.isCancelled()).toBe(true);
    });

    it('should convert items correctly', () => {
      // Arrange
      const items = [
        createOrderItemDocument({
          drinkId: 'drk_latte',
          drinkName: 'Caramel Latte',
          size: 'grande',
          quantity: 2,
          unitPriceCents: 550,
        }),
      ];
      const document = createOrderDocument({ items });

      // Act
      const order = OrderMapper.toDomain(document);

      // Assert
      expect(order.items).toHaveLength(1);
      expect(order.items[0].drinkName).toBe('Caramel Latte');
      expect(order.items[0].quantity).toBe(2);
      expect(order.items[0].size?.value).toBe('grande');
      expect(order.items[0].unitPrice.cents).toBe(550);
    });

    it('should convert item customizations correctly', () => {
      // Arrange
      const customizations = createCustomizationsDocument({
        milk: 'oat',
        syrup: 'vanilla',
      });
      const items = [createOrderItemDocument({ customizations })];
      const document = createOrderDocument({ items });

      // Act
      const order = OrderMapper.toDomain(document);

      // Assert
      expect(order.items[0].customizations.milk).toBe('oat');
      expect(order.items[0].customizations.syrup).toBe('vanilla');
    });

    it('should handle null size', () => {
      // Arrange
      const items = [createOrderItemDocument({ size: null })];
      const document = createOrderDocument({ items });

      // Act
      const order = OrderMapper.toDomain(document);

      // Assert
      expect(order.items[0].size).toBeNull();
    });

    it('should handle empty items array', () => {
      // Arrange
      const document = createOrderDocument({ items: [] });

      // Act
      const order = OrderMapper.toDomain(document);

      // Assert
      expect(order.items).toHaveLength(0);
      expect(order.isEmpty()).toBe(true);
    });

    it('should handle multiple items', () => {
      // Arrange
      const items = [
        createOrderItemDocument({ drinkName: 'Latte', quantity: 1 }),
        createOrderItemDocument({ drinkName: 'Espresso', quantity: 2 }),
        createOrderItemDocument({ drinkName: 'Cappuccino', quantity: 1 }),
      ];
      const document = createOrderDocument({ items });

      // Act
      const order = OrderMapper.toDomain(document);

      // Assert
      expect(order.items).toHaveLength(3);
      expect(order.totalQuantity).toBe(4);
    });
  });

  describe('toDocument', () => {
    it('should convert domain entity to document', () => {
      // Arrange
      const order = Order.create(OrderId.fromString('ord_test456'));

      // Act
      const document = OrderMapper.toDocument(order, 'conv_123');

      // Assert
      expect(document).toBeInstanceOf(OrderDocument);
      expect(document._id).toBe('ord_test456');
      expect(document.conversationId).toBe('conv_123');
      expect(document.status).toBe('pending');
    });

    it('should convert items correctly', () => {
      // Arrange
      const order = Order.create();
      const item = OrderItem.create({
        drinkId: DrinkId.fromString('drk_test'),
        drinkName: 'Mocha',
        size: DrinkSize.venti(),
        quantity: 3,
        unitPrice: Money.fromDollars(6),
        customizations: { milk: 'almond', syrup: 'hazelnut' },
      });
      order.addItem(item);

      // Act
      const document = OrderMapper.toDocument(order, 'conv_123');

      // Assert
      expect(document.items).toHaveLength(1);
      expect(document.items[0].drinkId).toBe('drk_test');
      expect(document.items[0].drinkName).toBe('Mocha');
      expect(document.items[0].size).toBe('venti');
      expect(document.items[0].quantity).toBe(3);
      expect(document.items[0].unitPriceCents).toBe(600);
      expect(document.items[0].currency).toBe('USD');
    });

    it('should convert customizations correctly', () => {
      // Arrange
      const order = Order.create();
      const item = OrderItem.create({
        drinkId: DrinkId.fromString('drk_test'),
        drinkName: 'Latte',
        unitPrice: Money.fromDollars(5),
        customizations: {
          milk: 'oat',
          syrup: 'caramel',
          sweetener: 'stevia',
          topping: 'whipped cream',
        },
      });
      order.addItem(item);

      // Act
      const document = OrderMapper.toDocument(order, 'conv_123');

      // Assert
      expect(document.items[0].customizations.milk).toBe('oat');
      expect(document.items[0].customizations.syrup).toBe('caramel');
      expect(document.items[0].customizations.sweetener).toBe('stevia');
      expect(document.items[0].customizations.topping).toBe('whipped cream');
    });

    it('should handle null size', () => {
      // Arrange
      const order = Order.create();
      const item = OrderItem.create({
        drinkId: DrinkId.fromString('drk_test'),
        drinkName: 'Espresso',
        size: null,
        unitPrice: Money.fromDollars(3),
      });
      order.addItem(item);

      // Act
      const document = OrderMapper.toDocument(order, 'conv_123');

      // Assert
      expect(document.items[0].size).toBeNull();
    });

    it('should preserve timestamps', () => {
      // Arrange
      const order = Order.create();

      // Act
      const document = OrderMapper.toDocument(order, 'conv_123');

      // Assert
      expect(document.createdAt).toEqual(order.createdAt);
      expect(document.updatedAt).toEqual(order.updatedAt);
    });

    it('should convert confirmed order status', () => {
      // Arrange
      const order = Order.create();
      order.addItem(
        OrderItem.create({
          drinkId: DrinkId.fromString('drk_test'),
          drinkName: 'Latte',
          unitPrice: Money.fromDollars(5),
        }),
      );
      order.confirm();

      // Act
      const document = OrderMapper.toDocument(order, 'conv_123');

      // Assert
      expect(document.status).toBe('confirmed');
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through domain -> document -> domain conversion', () => {
      // Arrange
      const original = Order.create(OrderId.fromString('ord_roundtrip'));
      original.addItem(
        OrderItem.create({
          drinkId: DrinkId.fromString('drk_test'),
          drinkName: 'Caramel Latte',
          size: DrinkSize.grande(),
          quantity: 2,
          unitPrice: Money.fromCents(550),
          customizations: { milk: 'oat', syrup: 'vanilla' },
        }),
      );

      // Act
      const document = OrderMapper.toDocument(original, 'conv_123');
      const restored = OrderMapper.toDomain(document);

      // Assert
      expect(restored.id.toString()).toBe(original.id.toString());
      expect(restored.status.toString()).toBe(original.status.toString());
      expect(restored.items).toHaveLength(original.items.length);
      expect(restored.items[0].drinkName).toBe(original.items[0].drinkName);
      expect(restored.items[0].quantity).toBe(original.items[0].quantity);
      expect(restored.items[0].customizations.milk).toBe(original.items[0].customizations.milk);
    });
  });
});
