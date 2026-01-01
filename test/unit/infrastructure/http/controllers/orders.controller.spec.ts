import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdersController } from '@infrastructure/http/controllers/orders.controller';
import { IOrderRepositoryPort } from '@application/ports/outbound';
import { Order } from '@domain/entities';
import { DrinkId, DrinkSize, Money, OrderId, OrderItem } from '@domain/value-objects';

describe('OrdersController', () => {
  let controller: OrdersController;
  let mockOrderRepository: jest.Mocked<IOrderRepositoryPort>;

  const createTestOrder = (
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' = 'pending',
  ): Order => {
    const order = Order.create(OrderId.generate());
    order.addItem(
      OrderItem.create({
        drinkId: DrinkId.generate(),
        drinkName: 'Latte',
        size: DrinkSize.grande(),
        quantity: 1,
        unitPrice: Money.fromDollars(5),
        customizations: {},
      }),
    );

    if (status === 'confirmed') {
      order.confirm();
    } else if (status === 'completed') {
      order.confirm();
      order.complete();
    } else if (status === 'cancelled') {
      order.cancel();
    }

    return order;
  };

  beforeEach(async () => {
    mockOrderRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findByConversationId: jest.fn(),
      saveWithConversation: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepositoryPort>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: 'IOrderRepository',
          useValue: mockOrderRepository,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  describe('getOrderById', () => {
    it('should return order when found', async () => {
      // Arrange
      const order = createTestOrder();
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await controller.getOrderById(order.id.toString());

      // Assert
      expect(result.id).toBe(order.id.toString());
      expect(result.status).toBe('pending');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].drinkName).toBe('Latte');
    });

    it('should throw NotFoundException when order not found', async () => {
      // Arrange
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getOrderById('ord_notfound')).rejects.toThrow(NotFoundException);
    });

    it('should include order totals', async () => {
      // Arrange
      const order = createTestOrder();
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await controller.getOrderById(order.id.toString());

      // Assert
      expect(result.totalPrice).toBeDefined();
      expect(result.totalQuantity).toBe(1);
    });

    it('should include timestamps', async () => {
      // Arrange
      const order = createTestOrder();
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act
      const result = await controller.getOrderById(order.id.toString());

      // Assert
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('confirmOrder', () => {
    it('should confirm pending order', async () => {
      // Arrange
      const order = createTestOrder('pending');
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue();

      // Act
      const result = await controller.confirmOrder(order.id.toString());

      // Assert
      expect(result.status).toBe('confirmed');
      expect(result.message).toBe('Order confirmed successfully');
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order not found', async () => {
      // Arrange
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.confirmOrder('ord_notfound')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order cannot be confirmed', async () => {
      // Arrange
      const order = createTestOrder('confirmed');
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act & Assert
      await expect(controller.confirmOrder(order.id.toString())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include total price in response', async () => {
      // Arrange
      const order = createTestOrder('pending');
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue();

      // Act
      const result = await controller.confirmOrder(order.id.toString());

      // Assert
      expect(result.totalPrice).toBeDefined();
    });
  });

  describe('cancelOrder', () => {
    it('should cancel pending order', async () => {
      // Arrange
      const order = createTestOrder('pending');
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue();

      // Act
      const result = await controller.cancelOrder(order.id.toString());

      // Assert
      expect(result.status).toBe('cancelled');
      expect(result.message).toBe('Order cancelled successfully');
      expect(mockOrderRepository.save).toHaveBeenCalled();
    });

    it('should cancel confirmed order', async () => {
      // Arrange
      const order = createTestOrder('confirmed');
      mockOrderRepository.findById.mockResolvedValue(order);
      mockOrderRepository.save.mockResolvedValue();

      // Act
      const result = await controller.cancelOrder(order.id.toString());

      // Assert
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundException when order not found', async () => {
      // Arrange
      mockOrderRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.cancelOrder('ord_notfound')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order cannot be cancelled', async () => {
      // Arrange
      const order = createTestOrder('completed');
      mockOrderRepository.findById.mockResolvedValue(order);

      // Act & Assert
      await expect(controller.cancelOrder(order.id.toString())).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
