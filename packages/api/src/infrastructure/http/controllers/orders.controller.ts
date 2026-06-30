import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { IOrderRepositoryPort } from '@application/ports/outbound';
import { OrderId } from '@domain/value-objects';

/**
 * Controller for order-related endpoints.
 *
 * Provides endpoints for managing orders including viewing,
 * confirming, and canceling orders. Orders are typically created
 * through the conversation flow with the barista AI.
 */
@ApiTags('Orders')
@Controller('api/v1/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    @Inject('IOrderRepository')
    private readonly orderRepository: IOrderRepositoryPort,
  ) {}

  /**
   * Get order details by ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Retrieve detailed information about a specific order including all items and status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 'ord_abc123-def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Order found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'ord_abc123-def456' },
        status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              drinkName: { type: 'string', example: 'Caffè Latte' },
              size: { type: 'string', example: 'grande' },
              quantity: { type: 'number', example: 1 },
              unitPrice: { type: 'string', example: '$4.75' },
              totalPrice: { type: 'string', example: '$4.75' },
              customizations: { type: 'object' },
            },
          },
        },
        totalPrice: { type: 'string', example: '$9.50' },
        totalQuantity: { type: 'number', example: 2 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async getOrderById(@Param('id') id: string): Promise<{
    id: string;
    status: string;
    items: Array<{
      drinkName: string;
      size: string | null;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      customizations: object;
    }>;
    totalPrice: string;
    totalQuantity: number;
    createdAt: string;
    updatedAt: string;
  }> {
    this.logger.debug(`Getting order by ID: ${id}`);

    const orderId = OrderId.fromString(id);
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      this.logger.debug(`Order not found: ${id}`);
      throw new NotFoundException(`Order with ID '${id}' not found`);
    }

    return {
      id: order.id.toString(),
      status: order.status.toString(),
      items: order.items.map((item) => ({
        drinkName: item.drinkName,
        size: item.size?.toString() ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice.format(),
        totalPrice: item.totalPrice.format(),
        customizations: item.customizations,
      })),
      totalPrice: order.totalPrice.format(),
      totalQuantity: order.totalQuantity,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  /**
   * Confirm an order.
   *
   * Changes the order status from 'pending' to 'confirmed'.
   * Only pending orders can be confirmed.
   */
  @Post(':id/confirm')
  @ApiOperation({
    summary: 'Confirm an order',
    description:
      'Confirm a pending order. The order must be in "pending" status and have at least one item.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 'ord_abc123-def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Order confirmed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', example: 'confirmed' },
        message: { type: 'string', example: 'Order confirmed successfully' },
        totalPrice: { type: 'string', example: '$9.50' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Order cannot be confirmed' })
  async confirmOrder(@Param('id') id: string): Promise<{
    id: string;
    status: string;
    message: string;
    totalPrice: string;
  }> {
    this.logger.debug(`Confirming order: ${id}`);

    const orderId = OrderId.fromString(id);
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      this.logger.debug(`Order not found: ${id}`);
      throw new NotFoundException(`Order with ID '${id}' not found`);
    }

    if (!order.canBeConfirmed()) {
      this.logger.warn(`Order ${id} cannot be confirmed (status: ${order.status.toString()})`);
      throw new BadRequestException(
        `Order cannot be confirmed. Current status: ${order.status.toString()}`,
      );
    }

    order.confirm();
    await this.orderRepository.save(order);

    this.logger.log(`Order confirmed: ${id}, total: ${order.totalPrice.format()}`);

    return {
      id: order.id.toString(),
      status: order.status.toString(),
      message: 'Order confirmed successfully',
      totalPrice: order.totalPrice.format(),
    };
  }

  /**
   * Cancel an order.
   *
   * Changes the order status to 'cancelled'.
   * Only pending or confirmed orders can be cancelled.
   */
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Cancel an order. Only pending or confirmed orders can be cancelled.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 'ord_abc123-def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', example: 'cancelled' },
        message: { type: 'string', example: 'Order cancelled successfully' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Order cannot be cancelled' })
  async cancelOrder(@Param('id') id: string): Promise<{
    id: string;
    status: string;
    message: string;
  }> {
    this.logger.debug(`Cancelling order: ${id}`);

    const orderId = OrderId.fromString(id);
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      this.logger.debug(`Order not found: ${id}`);
      throw new NotFoundException(`Order with ID '${id}' not found`);
    }

    try {
      order.cancel();
      await this.orderRepository.save(order);

      this.logger.log(`Order cancelled: ${id}`);

      return {
        id: order.id.toString(),
        status: order.status.toString(),
        message: 'Order cancelled successfully',
      };
    } catch (error) {
      this.logger.warn(`Order ${id} cannot be cancelled (status: ${order.status.toString()})`);
      throw new BadRequestException(
        `Order cannot be cancelled. Current status: ${order.status.toString()}`,
      );
    }
  }
}
