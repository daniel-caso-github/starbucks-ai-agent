import type { DrinkTemp } from './drink.dto';

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface OrderItemCustomizations {
  readonly milk?: string;
  readonly syrup?: string;
  readonly sweetener?: string;
  readonly topping?: string;
}

export interface OrderItemSummaryDto {
  readonly index: number;
  readonly drinkName: string;
  readonly size: string | null;
  readonly quantity: number;
  readonly price: string;
  readonly temp: DrinkTemp;
  readonly imageUrl: string;
  readonly customizations: OrderItemCustomizations;
}

export interface OrderSummaryDto {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly items: OrderItemSummaryDto[];
  readonly totalPrice: string;
  readonly itemCount: number;
  readonly canConfirm: boolean;
}

export interface OrderItemOutputDto {
  readonly drinkName: string;
  readonly size: string | null;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly totalPrice: string;
  readonly customizations: OrderItemCustomizations;
}

export interface OrderOutputDto {
  readonly orderId: string;
  readonly conversationId: string;
  readonly status: OrderStatus;
  readonly items: OrderItemOutputDto[];
  readonly totalPrice: string;
  readonly totalQuantity: number;
  readonly canBeModified: boolean;
  readonly canBeConfirmed: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
