import { Either } from '@application/common';
import { ApplicationError } from '@application/errors';
import {
  CreateOrderInputDto,
  AddItemToOrderInputDto,
  ConfirmOrderInputDto,
  CancelOrderInputDto,
  OrderOutputDto,
} from '@application/dtos';

export interface ICreateOrderPort {
  /**
   * Create a new order or add to an existing active order.
   *
   * If the conversation already has an active order (pending status),
   * the item will be added to that order. Otherwise, a new order is created.
   *
   * @param input - Order creation details with drink name
   * @returns Either an error or the created/updated order
   */
  execute(input: CreateOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>>;

  /**
   * Add an item to an existing order by order ID.
   *
   * @param input - Item details with order ID and drink name
   * @returns Either an error or the updated order
   */
  addItem(input: AddItemToOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>>;

  /**
   * Confirm an order by ID.
   *
   * @param input - Order ID to confirm
   * @returns Either an error or the confirmed order
   */
  confirmOrder(input: ConfirmOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>>;

  /**
   * Cancel an order by ID.
   *
   * @param input - Order ID to cancel
   * @returns Either an error or the cancelled order
   */
  cancelOrder(input: CancelOrderInputDto): Promise<Either<ApplicationError, OrderOutputDto>>;

  /**
   * Get an order by ID.
   *
   * @param orderId - The order identifier
   * @returns Either an error or the order details
   */
  getOrder(orderId: string): Promise<Either<ApplicationError, OrderOutputDto>>;
}
