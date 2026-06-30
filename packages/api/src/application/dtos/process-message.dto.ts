import { ConversationIntentType } from '@application/dtos/conversation-ai.dto';

export interface ProcessMessageInputDto {
  message: string;
  conversationId?: string;
  userId?: string;
}

export interface DrinkCardCustomizations {
  sizes: ('tall' | 'grande' | 'venti')[];
  milks: string[];
  syrups: string[];
}

export interface DrinkCardDto {
  drinkId: string;
  name: string;
  description: string;
  price: number;
  temp: 'hot' | 'iced';
  imageUrl: string;
  relevanceScore?: number;
  customizations: DrinkCardCustomizations;
}

export interface ProcessMessageOutputDto {
  response: string;
  conversationId: string;
  intent: ConversationIntentType;
  currentOrder: OrderSummaryDto | null;
  suggestedReplies: string[];
  cards?: DrinkCardDto[];
  openMenu?: boolean;
}

export interface OrderSummaryDto {
  orderId: string;
  status: string;
  items: OrderItemSummaryDto[];
  totalPrice: string;
  itemCount: number;
  canConfirm: boolean;
}

export interface OrderItemSummaryDto {
  index: number;
  drinkName: string;
  size: string | null;
  quantity: number;
  price: string;
  temp: 'hot' | 'iced';
  customizations: {
    milk?: string;
    syrup?: string;
    sweetener?: string;
    topping?: string;
  };
}
