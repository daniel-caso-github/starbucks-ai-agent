import type { ConversationIntentType } from './intent.dto';
import type { DrinkCardDto } from './drink.dto';
import type { OrderSummaryDto } from './order.dto';

export interface ProcessMessageInputDto {
  readonly message: string;
  readonly conversationId?: string;
  readonly userId?: string;
}

export interface ProcessMessageOutputDto {
  readonly response: string;
  readonly conversationId: string;
  readonly intent: ConversationIntentType;
  readonly currentOrder: OrderSummaryDto | null;
  readonly suggestedReplies: string[];
  readonly cards?: DrinkCardDto[];
  readonly openMenu?: boolean;
}

export interface SseChunkDto {
  readonly type: 'text' | 'complete' | 'error';
  readonly data: string | ProcessMessageOutputDto;
}
