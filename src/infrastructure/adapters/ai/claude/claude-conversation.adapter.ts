import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Drink } from '@domain/entities';
import { DrinkSize } from '@domain/value-objects';
import {
  IConversationAI,
  GenerateResponseInput,
  GenerateResponseOutput,
  ExtractedOrderInfo,
  ConversationIntent,
  SuggestedAction,
} from '@application/ports/outbound';

/**
 * Interface for the parsed JSON from Claude's order extraction.
 */
interface ParsedOrderJson {
  drinkName?: string | null;
  size?: string | null;
  quantity?: number;
  customizations?: {
    milk?: string | null;
    syrup?: string | null;
    sweetener?: string | null;
    topping?: string | null;
  };
  confidence?: number;
}

@Injectable()
export class ClaudeConversationAdapter implements IConversationAI, OnModuleInit {
  private readonly logger = new Logger(ClaudeConversationAdapter.name);
  private client!: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured');
      return;
    }

    this.client = new Anthropic({ apiKey });
    this.logger.log('Claude AI adapter initialized');
  }

  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    const systemPrompt = this.buildSystemPrompt(input.relevantDrinks, input.currentOrderSummary);
    const userMessage = this.buildUserMessage(input.userMessage, input.conversationHistory);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const responseText = textContent && 'text' in textContent ? textContent.text : '';

      return this.parseResponse(responseText, input.userMessage);
    } catch (error) {
      this.logger.error('Error generating Claude response', error);
      return this.createErrorResponse();
    }
  }

  async extractOrderFromMessage(
    message: string,
    availableDrinks: Drink[],
  ): Promise<ExtractedOrderInfo | null> {
    const drinkList = availableDrinks.map((d) => d.name).join(', ');

    const prompt = `Analyze this customer message and extract order information.

    Available drinks: ${drinkList}
    
    Customer message: "${message}"
    
    Extract the following in JSON format:
    {
      "drinkName": "exact drink name from the list or null",
      "size": "tall", "grande", or "venti" (or null),
      "quantity": number (default 1),
      "customizations": {
        "milk": "type of milk or null",
        "syrup": "syrup flavor or null",
        "sweetener": "sweetener type or null",
        "topping": "topping or null"
      },
      "confidence": 0.0 to 1.0
    }
    
    Respond with ONLY the JSON, no other text.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const text = textContent && 'text' in textContent ? textContent.text : '';

      return this.parseExtractedOrder(text);
    } catch (error) {
      this.logger.error('Error extracting order', error);
      return null;
    }
  }

  async detectIntent(message: string, conversationHistory?: string): Promise<ConversationIntent> {
    const context = conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : '';

    const prompt = `${context}Analyze this customer message and determine their intent.

    Customer message: "${message}"
    
    Possible intents:
    - order_drink: Customer wants to order a drink
    - modify_order: Customer wants to change their current order
    - cancel_order: Customer wants to cancel the order
    - confirm_order: Customer wants to confirm/complete the order
    - ask_question: Customer is asking about menu, prices, etc.
    - greeting: Customer is greeting or starting conversation
    - unknown: Intent cannot be determined
    
    Respond with ONLY one of the intent values, nothing else.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 32,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find((block) => block.type === 'text');
      const text = textContent && 'text' in textContent ? textContent.text : '';
      const intent = text.trim().toLowerCase();

      const validIntents: ConversationIntent[] = [
        'order_drink',
        'modify_order',
        'cancel_order',
        'confirm_order',
        'ask_question',
        'greeting',
        'unknown',
      ];

      return validIntents.includes(intent as ConversationIntent)
        ? (intent as ConversationIntent)
        : 'unknown';
    } catch (error) {
      this.logger.error('Error detecting intent', error);
      return 'unknown';
    }
  }

  async containsOrderIntent(message: string): Promise<boolean> {
    const intent = await this.detectIntent(message);
    return intent === 'order_drink' || intent === 'modify_order';
  }

  private buildSystemPrompt(relevantDrinks: Drink[], currentOrderSummary: string | null): string {
    const drinksContext =
      relevantDrinks.length > 0
        ? `\n\nAvailable drinks:\n${relevantDrinks.map((d) => d.toSummary()).join('\n')}`
        : '';

    const orderContext = currentOrderSummary ? `\n\nCurrent order:\n${currentOrderSummary}` : '';

    return `You are a friendly Starbucks barista AI. Help customers order drinks and answer menu questions.
          Guidelines:
          - Be warm and conversational
          - Help find drinks matching preferences
          - Suggest customizations when appropriate
          - Confirm orders before finalizing
          - Ask clarifying questions if unclear
          - Keep responses concise
          ${drinksContext}${orderContext}`;
  }

  private buildUserMessage(userMessage: string, conversationHistory: string): string {
    if (conversationHistory) {
      return `Previous conversation:\n${conversationHistory}\n\nCustomer: ${userMessage}`;
    }
    return `Customer: ${userMessage}`;
  }

  private async parseResponse(
    responseText: string,
    originalMessage: string,
  ): Promise<GenerateResponseOutput> {
    const intent = await this.detectIntent(originalMessage);

    let extractedOrder: ExtractedOrderInfo | null = null;
    if (intent === 'order_drink' || intent === 'modify_order') {
      extractedOrder = await this.extractOrderFromMessage(originalMessage, []);
    }

    const suggestedActions = this.generateSuggestedActions(intent, extractedOrder);

    return {
      message: responseText,
      intent,
      extractedOrder,
      suggestedActions,
    };
  }

  private parseExtractedOrder(jsonText: string): ExtractedOrderInfo | null {
    try {
      const cleanJson = jsonText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed: ParsedOrderJson = JSON.parse(cleanJson) as ParsedOrderJson;

      let size: DrinkSize | null = null;
      if (parsed.size) {
        try {
          size = DrinkSize.fromString(parsed.size);
        } catch {
          size = null;
        }
      }

      return {
        drinkName: parsed.drinkName ?? null,
        size,
        quantity: parsed.quantity ?? 1,
        customizations: {
          milk: parsed.customizations?.milk ?? undefined,
          syrup: parsed.customizations?.syrup ?? undefined,
          sweetener: parsed.customizations?.sweetener ?? undefined,
          topping: parsed.customizations?.topping ?? undefined,
        },
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (error) {
      this.logger.error('Error parsing order JSON', error);
      return null;
    }
  }

  private generateSuggestedActions(
    intent: ConversationIntent,
    extractedOrder: ExtractedOrderInfo | null,
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    switch (intent) {
      case 'order_drink':
        if (extractedOrder && extractedOrder.confidence > 0.7) {
          actions.push({
            type: 'add_item',
            payload: {
              drinkName: extractedOrder.drinkName,
              size: extractedOrder.size?.toString() ?? null,
              quantity: extractedOrder.quantity,
              confidence: extractedOrder.confidence,
            },
          });
        } else {
          actions.push({
            type: 'ask_clarification',
            payload: { reason: 'Could not identify drink order' },
          });
        }
        break;
      case 'confirm_order':
        actions.push({ type: 'confirm_order' });
        break;
      case 'cancel_order':
        actions.push({ type: 'cancel_order' });
        break;
      case 'modify_order':
        if (extractedOrder) {
          actions.push({
            type: 'update_quantity',
            payload: {
              drinkName: extractedOrder.drinkName,
              quantity: extractedOrder.quantity,
            },
          });
        }
        break;
    }

    return actions;
  }

  private createErrorResponse(): GenerateResponseOutput {
    return {
      message: "I'm sorry, I'm having trouble right now. Could you please repeat that?",
      intent: 'unknown',
      extractedOrder: null,
      suggestedActions: [],
    };
  }
}
