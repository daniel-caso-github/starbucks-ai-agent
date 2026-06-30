/**
 * DTOs for order-related use cases.
 *
 * Note: Input DTOs for order management are defined in the inbound port
 * (manage-order.port.ts). This file only contains output DTOs and
 * DTOs specific to the CreateOrderUseCase.
 */

/**
 * Input for creating a new order.
 * This is different from AddItemInput in the port because it uses drinkName
 * instead of drinkId, allowing the use case to handle the lookup.
 */
export interface CreateOrderInputDto {
  /** Conversation this order belongs to */
  readonly conversationId: string;

  /** Name of the drink to add (use case will look up the ID) */
  readonly drinkName: string;

  /** Size of the drink (tall, grande, venti) */
  readonly size?: string;

  /** Quantity to order (default: 1) */
  readonly quantity?: number;

  /** Customizations for the drink */
  readonly customizations?: {
    readonly milk?: string;
    readonly syrup?: string;
    readonly sweetener?: string;
    readonly topping?: string;
  };
}

/**
 * Input for adding an item to an existing order by order ID.
 * Named differently to avoid conflict with AddItemInput from ports.
 */
export interface AddItemToOrderInputDto {
  readonly orderId: string;
  readonly drinkName: string;
  readonly size?: string;
  readonly quantity?: number;
  readonly customizations?: {
    readonly milk?: string;
    readonly syrup?: string;
    readonly sweetener?: string;
    readonly topping?: string;
  };
}

/**
 * Input for confirming an order by ID.
 */
export interface ConfirmOrderInputDto {
  readonly orderId: string;
}

/**
 * Input for cancelling an order by ID.
 */
export interface CancelOrderInputDto {
  readonly orderId: string;
}

// ============ Output DTOs ============

/**
 * Item details in the order output.
 */
export interface OrderItemOutputDto {
  readonly drinkName: string;
  readonly size: string | null;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly totalPrice: string;
  readonly customizations: {
    readonly milk?: string;
    readonly syrup?: string;
    readonly sweetener?: string;
    readonly topping?: string;
  };
}

/**
 * Output after order operations.
 */
export interface OrderOutputDto {
  readonly orderId: string;
  readonly conversationId: string;
  readonly status: string;
  readonly items: OrderItemOutputDto[];
  readonly totalPrice: string;
  readonly totalQuantity: number;
  readonly canBeModified: boolean;
  readonly canBeConfirmed: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
