import { Injectable } from '@nestjs/common';
import { Drink } from '@domain/entities';
import { DrinkSize } from '@domain/value-objects';
import {
  ConversationIntentType,
  ExtractedOrderInfoDto,
  GenerateResponseInputDto,
  GenerateResponseOutputDto,
} from '@application/dtos/conversation-ai.dto';
import { IConversationAIPort } from '@application/ports/outbound';

interface KeywordAction {
  intent: ConversationIntentType;
  message: string;
  drinkName?: string;
  size?: DrinkSize;
  searchQuery?: string;
  openMenu?: boolean;
}

function detectAction(text: string): KeywordAction {
  const t = text.toLowerCase();

  // Explicit action patterns go first (highest specificity)

  // "quiero un [drink] [size]" — order pattern
  const orderMatch = t.match(/quiero un? (.+?)(?:\s+(grande|tall|venti))?(?:\s+(?:con|y) .+)?$/i);
  if (orderMatch) {
    const rawName = orderMatch[1].trim();
    const sizeStr = orderMatch[2]?.toLowerCase() ?? 'grande';
    return {
      intent: 'order_drink',
      message: `¡Listo! Agregué un ${rawName} ${sizeStr} a tu orden.`,
      drinkName: rawName,
      size: DrinkSize.fromString(sizeStr),
    };
  }

  // "agregar un [drink] [size]" — from menu modal button (requires "un" to avoid matching "agregar otro")
  const addMatch = t.match(/agregar un? (.+?)(?:\s+(grande|tall|venti))?$/i);
  if (addMatch) {
    const rawName = addMatch[1].trim();
    const sizeStr = addMatch[2]?.toLowerCase() ?? 'grande';
    return {
      intent: 'order_drink',
      message: `¡Listo! Agregué un ${rawName} ${sizeStr} a tu orden.`,
      drinkName: rawName,
      size: DrinkSize.fromString(sizeStr),
    };
  }

  // "quitar uno de [drink]" — from order panel minus button
  const removeOneMatch = t.match(/quitar uno de (.+)$/i);
  if (removeOneMatch) {
    return {
      intent: 'modify_order',
      message: 'Actualicé la cantidad en tu orden.',
      drinkName: removeOneMatch[1].trim(),
    };
  }

  // "agregar otro [drink]" — from order panel plus button
  const addOneMatch = t.match(/agregar otro (.+)$/i);
  if (addOneMatch) {
    return {
      intent: 'modify_order',
      message: 'Actualicé la cantidad en tu orden.',
      drinkName: addOneMatch[1].trim(),
    };
  }

  // "eliminar [drink] de mi orden"
  const eliminateMatch = t.match(/eliminar (.+?) de mi orden/i);
  if (eliminateMatch) {
    return {
      intent: 'modify_order',
      message: 'Eliminé esa bebida de tu orden.',
      drinkName: eliminateMatch[1].trim(),
    };
  }

  // "agregar otra bebida" — quick reply from pending order state
  if (/agregar otra|otra bebida/i.test(t)) {
    return {
      intent: 'ask_question',
      message: 'Claro, ¿qué más te gustaría agregar?',
      searchQuery: 'favoritas',
    };
  }

  if (t.includes('confirmar') || t.includes('confirm')) {
    return { intent: 'confirm_order', message: 'Tu orden ha sido confirmada. ¿Quieres proceder al pago?' };
  }

  if (t.includes('proceder al pago') || t.includes('pagar') || t.includes('pag')) {
    return { intent: 'process_payment', message: '¡Pago procesado! Tu pedido está en preparación.' };
  }

  if (t.includes('cancelar') || t.includes('cancel')) {
    return { intent: 'cancel_order', message: 'Cancelé tu orden. ¿Quieres empezar una nueva?' };
  }

  if (t.includes('menú') || t.includes('menu') || t.includes('ver menú') || t.includes('ver menu')) {
    return {
      intent: 'ask_question',
      message: 'Te abrí el menú completo con nuestras bebidas disponibles.',
      openMenu: true,
    };
  }

  // Keyword-based searches go last (lowest specificity)
  if (t.includes('caramelo') || t.includes('busca') || t.includes('buscar')) {
    return {
      intent: 'ask_question',
      message: 'Encontré estas opciones con caramelo:',
      searchQuery: 'caramelo',
    };
  }

  if (t.includes('frío') || t.includes('frio') || t.includes('helad') || t.includes('algo frío') || t.includes('algo frio')) {
    return {
      intent: 'ask_question',
      message: 'Para algo frío, te recomiendo estas:',
      searchQuery: 'cold',
    };
  }

  // greeting / default → recommend
  return {
    intent: 'greeting',
    message: '¡Hola! Soy tu barista en Verde. ¿Qué te preparo hoy?',
    searchQuery: 'favoritas',
  };
}

@Injectable()
export class DeterministicConversationAdapter implements IConversationAIPort {
  async generateResponse(input: GenerateResponseInputDto): Promise<GenerateResponseOutputDto> {
    const action = detectAction(input.userMessage);
    return this.buildOutput(action, input.userMessage);
  }

  async extractOrderFromMessage(_message: string, _drinks: Drink[]): Promise<ExtractedOrderInfoDto | null> {
    return null;
  }

  async detectIntent(message: string): Promise<ConversationIntentType> {
    return detectAction(message).intent;
  }

  async containsOrderIntent(_message: string): Promise<boolean> {
    return false;
  }

  async *generateResponseStream(
    input: GenerateResponseInputDto,
  ): AsyncGenerator<string, GenerateResponseOutputDto, unknown> {
    const action = detectAction(input.userMessage);
    const output = this.buildOutput(action, input.userMessage);

    // Emit text in small chunks to simulate streaming
    const chunks = output.message.match(/.{1,8}/g) ?? [output.message];
    for (const chunk of chunks) {
      yield chunk;
    }

    return output;
  }

  private buildOutput(action: KeywordAction, _userMessage: string): GenerateResponseOutputDto {
    const suggestedActions = [];

    if (action.openMenu) {
      suggestedActions.push({ type: 'get_full_menu' as const });
    }

    if (action.searchQuery) {
      suggestedActions.push({
        type: 'search_drinks' as const,
        payload: { query: action.searchQuery },
      });
    }

    let extractedOrder: ExtractedOrderInfoDto | null = null;
    if (action.intent === 'order_drink' && action.drinkName) {
      extractedOrder = {
        drinkName: action.drinkName,
        size: action.size ?? DrinkSize.fromString('grande'),
        quantity: 1,
        customizations: {},
        confidence: 0.95,
      };
    }

    const extractedModifications: Array<{
      action: 'modify' | 'remove';
      drinkName?: string;
      changes?: { newQuantity?: number };
      confidence: number;
    }> = [];
    if (action.intent === 'modify_order' && action.drinkName) {
      const userText = _userMessage.toLowerCase();
      if (userText.includes('quitar uno') || userText.includes('eliminar')) {
        extractedModifications.push({
          action: 'modify' as const,
          drinkName: action.drinkName,
          changes: { newQuantity: 0 },
          confidence: 0.95,
        });
      } else if (userText.includes('agregar otro')) {
        extractedModifications.push({
          action: 'modify' as const,
          drinkName: action.drinkName,
          changes: { newQuantity: 2 },
          confidence: 0.95,
        });
      }
    }

    return {
      message: action.message,
      intent: action.intent,
      extractedOrder,
      extractedOrders: extractedOrder
        ? { items: [{ ...extractedOrder, drinkName: extractedOrder.drinkName! }] }
        : null,
      extractedModifications,
      suggestedActions,
    };
  }
}
