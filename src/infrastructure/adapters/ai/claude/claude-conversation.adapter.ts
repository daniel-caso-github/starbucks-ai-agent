import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  Message,
  MessageParam,
  TextBlock,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';
import { Drink } from '@domain/entities';
import { DrinkSize } from '@domain/value-objects';
import { IConversationAIPort } from '@application/ports/outbound';
import {
  ConversationIntentType,
  ExtractedModificationDto,
  ExtractedOrderInfoDto,
  ExtractedOrderItemDto,
  ExtractedOrdersDto,
  GenerateResponseInputDto,
  GenerateResponseOutputDto,
  SuggestedActionType,
} from '@application/dtos/conversation-ai.dto';
import {
  BARISTA_TOOLS,
  CancelOrderInput,
  ConfirmOrderInput,
  CreateOrderInput,
  ModifyOrderInput,
  RemoveFromOrderInput,
  SearchDrinksInput,
} from './tools';
import { buildBaristaSystemPrompt, INTENT_DETECTION_PROMPT } from './prompts';

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Result of processing a tool call
 */
interface ToolCallResult {
  toolName: string;
  toolInput: unknown;
  result: string;
  suggestedAction?: SuggestedActionType;
  extractedOrder?: ExtractedOrderItemDto | null;
  extractedModification?: ExtractedModificationDto | null;
}

/**
 * Claude AI adapter implementing the IConversationAIPort interface.
 *
 * This adapter uses Anthropic's Tool Calling feature to enable Claude
 * to perform structured actions like creating orders, searching drinks,
 * and managing the order flow. Tool Calling is more reliable than
 * asking Claude to output JSON because:
 *
 * 1. The SDK validates tool inputs against the schema automatically
 * 2. Claude is trained specifically on tool use patterns
 * 3. We get structured data without manual parsing
 * 4. Error handling is more predictable
 *
 * The adapter also implements retry logic with exponential backoff
 * to handle transient API failures gracefully.
 */
@Injectable()
export class ClaudeConversationAdapter implements IConversationAIPort, OnModuleInit {
  private readonly logger = new Logger(ClaudeConversationAdapter.name);
  private client!: Anthropic;
  private initialized = false;

  // Model configuration
  private readonly model = 'claude-sonnet-4-20250514';
  private readonly maxTokens = 1024;

  // Retry configuration with exponential backoff
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  };

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initializes the Anthropic client when the NestJS module starts.
   * This is called automatically by NestJS after dependency injection.
   */
  onModuleInit(): void {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey || apiKey === 'your_api_key_here') {
      this.logger.warn('ANTHROPIC_API_KEY not configured - Claude AI features will not work');
      return;
    }

    this.client = new Anthropic({ apiKey });
    this.initialized = true;
    this.logger.log(`Claude AI adapter initialized with model: ${this.model}`);
  }

  /**
   * Generates a barista response to the user's message.
   *
   * This is the main entry point for conversation. It:
   * 1. Builds a context-aware system prompt with available drinks and current order
   * 2. Sends the message to Claude with tool definitions
   * 3. Processes any tool calls Claude makes
   * 4. Returns the response with extracted actions and order information
   *
   * The method uses RAG (Retrieval Augmented Generation) by including
   * relevant drinks in the system prompt context.
   */
  async generateResponse(input: GenerateResponseInputDto): Promise<GenerateResponseOutputDto> {
    if (!this.initialized) {
      return this.createErrorResponse(
        'Lo siento, aún no estoy completamente configurado. Por favor intenta de nuevo en un momento.',
      );
    }

    try {
      // Build the system prompt with context about available drinks and current order
      const systemPrompt = buildBaristaSystemPrompt({
        availableDrinks: input.relevantDrinks.map((d) => d.toSummary()),
        currentOrderSummary: input.currentOrderSummary,
        timeOfDay: this.getCurrentTimeOfDay(),
      });

      // Build the messages array from conversation history
      const messages = this.buildMessages(input.userMessage, input.conversationHistory);

      // Call Claude with tools
      const response = await this.callClaudeWithRetry(systemPrompt, messages);

      // Process the response, handling any tool calls
      return await this.processResponse(response, input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generating response: ${message}`);
      return this.createErrorResponse(
        'Estoy teniendo un pequeño problema en este momento. ¿Podrías intentar de nuevo?',
      );
    }
  }

  /**
   * Extracts order information from a user message.
   *
   * This method asks Claude to analyze a message and extract any
   * order-related information like drink name, size, and customizations.
   * It uses a specialized prompt focused on extraction rather than conversation.
   */
  async extractOrderFromMessage(
    message: string,
    availableDrinks: Drink[],
  ): Promise<ExtractedOrderInfoDto | null> {
    if (!this.initialized) {
      return null;
    }

    const drinkNames = availableDrinks.map((d) => d.name);
    const prompt = `Extrae la información del pedido de este mensaje del cliente.

Bebidas disponibles en nuestro menú: ${drinkNames.join(', ')}

El cliente dijo: "${message}"

Si el cliente está ordenando una bebida, usa la herramienta create_order con la información extraída.
Si no puedes identificar un pedido de bebida específico, responde con texto explicando qué necesitas aclarar.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        tools: [BARISTA_TOOLS.find((t) => t.name === 'create_order')!],
        messages: [{ role: 'user', content: prompt }],
      });

      // Look for a create_order tool call in the response
      const toolUse = response.content.find(
        (block): block is ToolUseBlock =>
          block.type === 'tool_use' && block.name === 'create_order',
      );

      if (toolUse) {
        const input = toolUse.input as CreateOrderInput;
        return this.createOrderInputToExtractedOrderItem(input);
      }

      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error extracting order: ${message}`);
      return null;
    }
  }

  /**
   * Detects the user's intent from their message.
   *
   * This is useful for routing logic before full response generation.
   * It uses a lightweight prompt specifically designed for classification.
   */
  async detectIntent(
    message: string,
    conversationHistory?: string,
  ): Promise<ConversationIntentType> {
    if (!this.initialized) {
      return 'unknown';
    }

    const contextPrefix = conversationHistory
      ? `Recent conversation:\n${conversationHistory}\n\n`
      : '';

    const prompt = `${contextPrefix}${INTENT_DETECTION_PROMPT}

Customer message: "${message}"`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 32,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((block): block is TextBlock => block.type === 'text');

      if (textBlock) {
        const intent = textBlock.text.trim().toLowerCase();
        return this.normalizeIntent(intent);
      }

      return 'unknown';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error detecting intent: ${message}`);
      return 'unknown';
    }
  }

  /**
   * Quick check to see if a message contains an order intent.
   * More efficient than full intent detection when you only need
   * to know if the message is order-related.
   */
  async containsOrderIntent(message: string): Promise<boolean> {
    const intent = await this.detectIntent(message);
    return intent === 'order_drink' || intent === 'modify_order';
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Calls the Claude API with retry logic and exponential backoff.
   *
   * This helps handle transient failures like rate limits or
   * temporary network issues gracefully.
   */
  private async callClaudeWithRetry(
    systemPrompt: string,
    messages: MessageParam[],
  ): Promise<Message> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          tools: BARISTA_TOOLS,
          messages,
        });
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, attempt),
          this.retryConfig.maxDelayMs,
        );

        this.logger.warn(
          `Claude API call failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries}), ` +
            `retrying in ${delay}ms: ${lastError.message}`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Failed to call Claude API after retries');
  }

  /**
   * Determines if an error should not be retried.
   * Authentication errors and invalid requests won't be fixed by retrying.
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
      // Don't retry authentication or validation errors
      return error.status === 401 || error.status === 400 || error.status === 403;
    }
    return false;
  }

  /**
   * Builds the messages array for the Claude API call.
   *
   * Converts our conversation history string into the format
   * expected by the Anthropic SDK.
   */
  private buildMessages(userMessage: string, conversationHistory: string): MessageParam[] {
    const messages: MessageParam[] = [];

    // Parse conversation history if provided
    if (conversationHistory) {
      const historyLines = conversationHistory.split('\n');
      let currentRole: 'user' | 'assistant' | null = null;
      let currentContent = '';

      for (const line of historyLines) {
        if (line.startsWith('Customer: ')) {
          // Save previous message if exists
          if (currentRole && currentContent) {
            messages.push({ role: currentRole, content: currentContent.trim() });
          }
          currentRole = 'user';
          currentContent = line.substring('Customer: '.length);
        } else if (line.startsWith('Barista: ')) {
          if (currentRole && currentContent) {
            messages.push({ role: currentRole, content: currentContent.trim() });
          }
          currentRole = 'assistant';
          currentContent = line.substring('Barista: '.length);
        } else if (currentRole) {
          currentContent += '\n' + line;
        }
      }

      // Don't forget the last message
      if (currentRole && currentContent) {
        messages.push({ role: currentRole, content: currentContent.trim() });
      }
    }

    // Add the current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * Processes Claude's response, handling both text and tool calls.
   *
   * When Claude decides to use a tool, this method:
   * 1. Extracts ALL tool call information (supports multiple items/modifications)
   * 2. Creates the appropriate suggested actions
   * 3. Extracts order information and modifications
   * 4. Returns everything in a structured format
   */
  private async processResponse(
    response: Message,
    input: GenerateResponseInputDto,
  ): Promise<GenerateResponseOutputDto> {
    const textBlocks: string[] = [];
    const toolCalls: ToolCallResult[] = [];

    // Log how many content blocks we received
    this.logger.debug(`Processing response with ${response.content.length} content blocks`);

    // Process each content block in the response
    for (const block of response.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use') {
        this.logger.debug(`Tool call: ${block.name} with input: ${JSON.stringify(block.input)}`);
        const toolResult = this.processToolCall(block);
        toolCalls.push(toolResult);
      }
    }

    this.logger.debug(`Processed ${toolCalls.length} tool calls`);

    // Combine text blocks into the response message
    const message = textBlocks.join('\n').trim();

    // Determine intent from tool calls or detect it
    let intent: ConversationIntentType = 'unknown';
    let extractedOrder: ExtractedOrderInfoDto | null = null;
    let extractedOrders: ExtractedOrdersDto | null = null;
    const extractedModifications: ExtractedModificationDto[] = [];
    const suggestedActions: SuggestedActionType[] = [];

    if (toolCalls.length > 0) {
      // Process ALL tool calls to support multiple items and modifications
      const orderItems: ExtractedOrderItemDto[] = [];

      for (const toolCall of toolCalls) {
        // Collect all suggested actions
        if (toolCall.suggestedAction) {
          suggestedActions.push(toolCall.suggestedAction);
        }

        // Collect all extracted order items
        if (toolCall.extractedOrder) {
          orderItems.push(toolCall.extractedOrder);
        }

        // Collect all extracted modifications
        if (toolCall.extractedModification) {
          extractedModifications.push(toolCall.extractedModification);
        }
      }

      // Build extractedOrders if we have any order items
      if (orderItems.length > 0) {
        extractedOrders = { items: orderItems };
        // For backward compatibility, set extractedOrder to the first item
        extractedOrder = orderItems[0];
      }

      // Use the first tool call to determine primary intent
      const primaryToolCall = toolCalls[0];
      intent = this.toolNameToIntent(primaryToolCall.toolName);
    } else {
      // No tool calls, detect intent from the original message
      intent = await this.detectIntent(input.userMessage, input.conversationHistory);
    }

    return {
      message: message || this.getDefaultMessageForIntent(intent),
      intent,
      extractedOrder,
      extractedOrders,
      extractedModifications,
      suggestedActions,
    };
  }

  /**
   * Processes a single tool call from Claude's response.
   *
   * This extracts the relevant information and creates the
   * appropriate suggested action for the use case to handle.
   */
  private processToolCall(toolBlock: ToolUseBlock): ToolCallResult {
    const { name, input } = toolBlock;

    const result: ToolCallResult = {
      toolName: name,
      toolInput: input,
      result: 'processed',
    };

    switch (name) {
      case 'create_order': {
        const orderInput = input as CreateOrderInput;
        result.extractedOrder = this.createOrderInputToExtractedOrderItem(orderInput);
        result.suggestedAction = {
          type: 'add_item',
          payload: {
            drinkName: orderInput.drinkName,
            size: orderInput.size || 'grande',
            quantity: orderInput.quantity || 1,
            customizations: orderInput.customizations,
          },
        };
        break;
      }

      case 'modify_order': {
        const modifyInput = input as ModifyOrderInput;
        result.extractedModification = {
          action: 'modify',
          drinkName: modifyInput.drinkName,
          itemIndex: modifyInput.itemIndex,
          changes: {
            newQuantity: modifyInput.changes.newQuantity,
            newSize: modifyInput.changes.newSize
              ? DrinkSize.fromString(modifyInput.changes.newSize)
              : undefined,
            addCustomizations: modifyInput.changes.addCustomizations,
            removeCustomizations: modifyInput.changes.removeCustomizations,
          },
          confidence: 0.95,
        };
        result.suggestedAction = {
          type: 'update_item',
          payload: {
            drinkName: modifyInput.drinkName,
            itemIndex: modifyInput.itemIndex,
            changes: modifyInput.changes,
          },
        };
        break;
      }

      case 'remove_from_order': {
        const removeInput = input as RemoveFromOrderInput;
        result.extractedModification = {
          action: 'remove',
          drinkName: removeInput.drinkName,
          itemIndex: removeInput.itemIndex,
          confidence: 0.95,
        };
        result.suggestedAction = {
          type: 'remove_item',
          payload: {
            drinkName: removeInput.drinkName,
            itemIndex: removeInput.itemIndex,
          },
        };
        break;
      }

      case 'search_drinks': {
        const searchInput = input as SearchDrinksInput;
        result.suggestedAction = {
          type: 'search_drinks',
          payload: {
            query: searchInput.query,
            filters: searchInput.filters,
          },
        };
        break;
      }

      case 'confirm_order': {
        const confirmInput = input as ConfirmOrderInput;
        result.suggestedAction = {
          type: 'confirm_order',
          payload: { message: confirmInput.confirmationMessage },
        };
        break;
      }

      case 'cancel_order': {
        const cancelInput = input as CancelOrderInput;
        result.suggestedAction = {
          type: 'cancel_order',
          payload: { reason: cancelInput.reason },
        };
        break;
      }

      case 'get_order_summary': {
        result.suggestedAction = {
          type: 'get_summary',
        };
        break;
      }

      case 'process_payment': {
        result.suggestedAction = {
          type: 'confirm_order', // Reuse confirm_order action type for payment
          payload: { isPayment: true },
        };
        break;
      }
    }

    return result;
  }

  /**
   * Converts a CreateOrderInput from tool calling to our ExtractedOrderItemDto.
   */
  private createOrderInputToExtractedOrderItem(input: CreateOrderInput): ExtractedOrderItemDto {
    let size: DrinkSize | null = null;

    if (input.size) {
      try {
        size = DrinkSize.fromString(input.size);
      } catch {
        // Default to grande if parsing fails
        size = DrinkSize.grande();
      }
    }

    return {
      drinkName: input.drinkName,
      size,
      quantity: input.quantity || 1,
      customizations: {
        milk: input.customizations?.milk,
        syrup: input.customizations?.syrup,
        sweetener: undefined, // Map from temperature/sweetness if needed
        topping: input.customizations?.topping,
      },
      confidence: 0.95, // High confidence since it came from tool calling
    };
  }

  /**
   * Maps tool names to conversation intents.
   */
  private toolNameToIntent(toolName: string): ConversationIntentType {
    const mapping: Record<string, ConversationIntentType> = {
      create_order: 'order_drink',
      modify_order: 'modify_order',
      remove_from_order: 'modify_order',
      search_drinks: 'ask_question',
      confirm_order: 'confirm_order',
      cancel_order: 'cancel_order',
      get_order_summary: 'ask_question',
      process_payment: 'process_payment',
    };

    return mapping[toolName] || 'unknown';
  }

  /**
   * Normalizes intent strings to our defined types.
   */
  private normalizeIntent(intent: string): ConversationIntentType {
    const validIntents: ConversationIntentType[] = [
      'order_drink',
      'modify_order',
      'cancel_order',
      'confirm_order',
      'process_payment',
      'ask_question',
      'greeting',
      'unknown',
    ];

    // Handle variations
    const normalized = intent
      .replace('get_recommendations', 'ask_question')
      .replace('remove_item', 'modify_order')
      .replace('farewell', 'greeting')
      .replace('other', 'unknown');

    return validIntents.includes(normalized as ConversationIntentType)
      ? (normalized as ConversationIntentType)
      : 'unknown';
  }

  /**
   * Returns a default message when Claude doesn't provide text.
   */
  private getDefaultMessageForIntent(intent: ConversationIntentType): string {
    const defaults: Record<ConversationIntentType, string> = {
      order_drink: '¡Lo agregué a tu orden!',
      modify_order: 'He actualizado tu orden.',
      cancel_order: 'Tu orden ha sido cancelada.',
      confirm_order: '¡Tu orden está confirmada! Puedes proceder al pago.',
      process_payment: '¡Gracias por tu compra! Tu orden está lista. ¡Que disfrutes tus bebidas!',
      ask_question: 'Déjame ayudarte con eso.',
      greeting: '¡Bienvenido a Starbucks! ¿Qué te puedo servir hoy?',
      unknown: '¿En qué te puedo ayudar hoy?',
    };

    return defaults[intent];
  }

  /**
   * Creates an error response with the given message.
   */
  private createErrorResponse(message: string): GenerateResponseOutputDto {
    return {
      message,
      intent: 'unknown',
      extractedOrder: null,
      extractedOrders: null,
      extractedModifications: [],
      suggestedActions: [],
    };
  }

  /**
   * Gets the current time of day for contextual greetings.
   */
  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();

    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Helper to pause execution for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
