import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EnvConfigService } from '@infrastructure/config';
import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  Content,
  Part,
  FunctionCall,
  GoogleGenerativeAIError,
} from '@google/generative-ai';
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
  CREATE_ORDER_TOOL,
  CancelOrderInput,
  ConfirmOrderInput,
  CreateOrderInput,
  GetDrinkDetailsInput,
  ModifyOrderInput,
  RemoveFromOrderInput,
  SearchDrinksInput,
} from './tools';
import { buildBaristaSystemPrompt, INTENT_DETECTION_PROMPT } from './prompts';
import { MessageSanitizerService } from './services';

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Result of processing a function call
 */
interface FunctionCallResult {
  functionName: string;
  functionArgs: unknown;
  result: string;
  suggestedAction?: SuggestedActionType;
  extractedOrder?: ExtractedOrderItemDto | null;
  extractedModification?: ExtractedModificationDto | null;
}

/**
 * Gemini AI adapter implementing the IConversationAIPort interface.
 *
 * This adapter uses Google's Function Calling feature to enable Gemini
 * to perform structured actions like creating orders, searching drinks,
 * and managing the order flow.
 *
 * The adapter implements retry logic with exponential backoff
 * to handle transient API failures gracefully.
 */
@Injectable()
export class GeminiConversationAdapter implements IConversationAIPort, OnModuleInit {
  private readonly logger = new Logger(GeminiConversationAdapter.name);
  private genAI!: GoogleGenerativeAI;
  private initialized = false;

  // Model configuration - flash-lite doesn't reliably call functions, use regular flash
  private readonly modelName = 'gemini-2.0-flash-lite';
  private readonly maxOutputTokens = 512;

  // Retry configuration with exponential backoff
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  };

  constructor(
    private readonly envConfig: EnvConfigService,
    private readonly messageSanitizer: MessageSanitizerService,
  ) {}

  /**
   * Initializes the Gemini client when the NestJS module starts.
   * This is called automatically by NestJS after dependency injection.
   */
  onModuleInit(): void {
    const apiKey = this.envConfig.googleAiApiKey;

    if (!apiKey || apiKey === 'your_api_key_here') {
      this.logger.warn('GOOGLE_AI_API_KEY not configured - Gemini AI features will not work');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.initialized = true;
    this.logger.log(`Gemini AI adapter initialized with model: ${this.modelName}`);
  }

  /**
   * Generates a barista response to the user's message.
   *
   * This is the main entry point for conversation. It:
   * 1. Builds a context-aware system prompt with available drinks and current order
   * 2. Sends the message to Gemini with function definitions
   * 3. Processes any function calls Gemini makes
   * 4. Returns the response with extracted actions and order information
   */
  async generateResponse(input: GenerateResponseInputDto): Promise<GenerateResponseOutputDto> {
    if (!this.initialized) {
      return this.createErrorResponse(
        'Lo siento, aún no estoy completamente configurado. Por favor intenta de nuevo en un momento.',
      );
    }

    try {
      // Sanitize user message before processing
      const sanitizedMessage = this.messageSanitizer.sanitize(input.userMessage);

      // Build the system prompt with context about available drinks and current order
      const systemPrompt = buildBaristaSystemPrompt({
        availableDrinks: input.relevantDrinks.map((d) => d.toSummary()),
        currentOrderSummary: input.currentOrderSummary,
        timeOfDay: this.getCurrentTimeOfDay(),
      });

      // Build the contents array from conversation history
      const contents = this.buildContents(sanitizedMessage, input.conversationHistory);

      // Call Gemini with function calling
      const response = await this.callGeminiWithRetry(systemPrompt, contents);

      // Process the response, handling any function calls
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
   */
  async extractOrderFromMessage(
    message: string,
    availableDrinks: Drink[],
  ): Promise<ExtractedOrderInfoDto | null> {
    if (!this.initialized) {
      return null;
    }

    // Sanitize the message before processing
    const sanitizedMessage = this.messageSanitizer.sanitize(message);

    const drinkNames = availableDrinks.map((d) => d.name);
    const prompt = `Extrae la información del pedido de este mensaje del cliente.

Bebidas disponibles en nuestro menú: ${drinkNames.join(', ')}

El cliente dijo: "${sanitizedMessage}"

Si el cliente está ordenando una bebida, usa la función create_order con la información extraída.
Si no puedes identificar un pedido de bebida específico, responde con texto explicando qué necesitas aclarar.`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        tools: [{ functionDeclarations: [CREATE_ORDER_TOOL] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;

      // Look for a create_order function call in the response
      const functionCall = this.extractFunctionCall(response.candidates?.[0]?.content?.parts);

      if (functionCall && functionCall.name === 'create_order') {
        const args = functionCall.args as CreateOrderInput;
        return this.createOrderInputToExtractedOrderItem(args);
      }

      return null;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error extracting order: ${errMessage}`);
      return null;
    }
  }

  /**
   * Detects the user's intent from their message.
   */
  async detectIntent(
    message: string,
    conversationHistory?: string,
  ): Promise<ConversationIntentType> {
    if (!this.initialized) {
      return 'unknown';
    }

    // Sanitize the message before processing
    const sanitizedMessage = this.messageSanitizer.sanitize(message);

    const contextPrefix = conversationHistory
      ? `Recent conversation:\n${conversationHistory}\n\n`
      : '';

    const prompt = `${contextPrefix}${INTENT_DETECTION_PROMPT}

Customer message: "${sanitizedMessage}"`;

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (text) {
        const intent = text.trim().toLowerCase();
        return this.normalizeIntent(intent);
      }

      return 'unknown';
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error detecting intent: ${errMessage}`);
      return 'unknown';
    }
  }

  /**
   * Quick check to see if a message contains an order intent.
   */
  async containsOrderIntent(message: string): Promise<boolean> {
    const intent = await this.detectIntent(message);
    return intent === 'order_drink' || intent === 'modify_order';
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Calls the Gemini API with retry logic and exponential backoff.
   */
  private async callGeminiWithRetry(
    systemPrompt: string,
    contents: Content[],
  ): Promise<{ text: string; functionCalls: FunctionCall[] }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: this.modelName,
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: BARISTA_TOOLS }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
          generationConfig: {
            maxOutputTokens: this.maxOutputTokens,
          },
        });

        const result = await model.generateContent({ contents });
        const response = result.response;

        // Extract text and function calls from the response
        const parts = response.candidates?.[0]?.content?.parts || [];
        const textParts = parts.filter((p): p is Part & { text: string } => 'text' in p);
        const text = textParts.map((p) => p.text).join('\n');

        const functionCalls = this.extractAllFunctionCalls(parts);

        return { text, functionCalls };
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
          `Gemini API call failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries}), ` +
            `retrying in ${delay}ms: ${lastError.message}`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Failed to call Gemini API after retries');
  }

  /**
   * Determines if an error should not be retried.
   */
  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof GoogleGenerativeAIError) {
      // Check for authentication or validation errors in the message
      const message = error.message.toLowerCase();
      return (
        message.includes('api key') ||
        message.includes('invalid') ||
        message.includes('unauthorized')
      );
    }
    return false;
  }

  /**
   * Extracts all function calls from response parts.
   */
  private extractAllFunctionCalls(parts: Part[]): FunctionCall[] {
    const functionCalls: FunctionCall[] = [];
    for (const part of parts) {
      if ('functionCall' in part && part.functionCall) {
        functionCalls.push(part.functionCall);
      }
    }
    return functionCalls;
  }

  /**
   * Extracts a single function call from response parts.
   */
  private extractFunctionCall(parts?: Part[]): FunctionCall | null {
    if (!parts) return null;
    for (const part of parts) {
      if ('functionCall' in part && part.functionCall) {
        return part.functionCall;
      }
    }
    return null;
  }

  /**
   * Builds the contents array for the Gemini API call.
   * Parses conversation history in format "[role]: content"
   */
  private buildContents(userMessage: string, conversationHistory: string): Content[] {
    const contents: Content[] = [];

    // Parse conversation history if provided
    if (conversationHistory) {
      const historyLines = conversationHistory.split('\n');
      let currentRole: 'user' | 'model' | null = null;
      let currentContent = '';

      for (const line of historyLines) {
        // Match format: [user]: message or [assistant]: message
        if (line.startsWith('[user]: ')) {
          // Save previous message if exists
          if (currentRole && currentContent) {
            contents.push({ role: currentRole, parts: [{ text: currentContent.trim() }] });
          }
          currentRole = 'user';
          currentContent = line.substring('[user]: '.length);
        } else if (line.startsWith('[assistant]: ')) {
          if (currentRole && currentContent) {
            contents.push({ role: currentRole, parts: [{ text: currentContent.trim() }] });
          }
          currentRole = 'model';
          currentContent = line.substring('[assistant]: '.length);
        } else if (currentRole) {
          currentContent += '\n' + line;
        }
      }

      // Don't forget the last message
      if (currentRole && currentContent) {
        contents.push({ role: currentRole, parts: [{ text: currentContent.trim() }] });
      }
    }

    // Add the current user message
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    return contents;
  }

  /**
   * Processes Gemini's response, handling both text and function calls.
   */
  private async processResponse(
    response: { text: string; functionCalls: FunctionCall[] },
    input: GenerateResponseInputDto,
  ): Promise<GenerateResponseOutputDto> {
    const { text, functionCalls } = response;

    this.logger.debug(`Processing response with ${functionCalls.length} function calls`);

    const processedCalls: FunctionCallResult[] = [];

    // Process each function call
    for (const fc of functionCalls) {
      this.logger.debug(`Function call: ${fc.name} with args: ${JSON.stringify(fc.args)}`);
      const result = this.processFunctionCall(fc);
      processedCalls.push(result);
    }

    this.logger.debug(`Processed ${processedCalls.length} function calls`);

    // Determine intent from function calls or detect it
    let intent: ConversationIntentType = 'unknown';
    let extractedOrder: ExtractedOrderInfoDto | null = null;
    let extractedOrders: ExtractedOrdersDto | null = null;
    const extractedModifications: ExtractedModificationDto[] = [];
    const suggestedActions: SuggestedActionType[] = [];

    if (processedCalls.length > 0) {
      const orderItems: ExtractedOrderItemDto[] = [];

      for (const call of processedCalls) {
        if (call.suggestedAction) {
          suggestedActions.push(call.suggestedAction);
        }
        if (call.extractedOrder) {
          orderItems.push(call.extractedOrder);
        }
        if (call.extractedModification) {
          extractedModifications.push(call.extractedModification);
        }
      }

      if (orderItems.length > 0) {
        extractedOrders = { items: orderItems };
        extractedOrder = orderItems[0];
      }

      const primaryCall = processedCalls[0];
      intent = this.functionNameToIntent(primaryCall.functionName);
    } else {
      intent = await this.detectIntent(input.userMessage, input.conversationHistory);
    }

    // Sanitize response to remove any code-like patterns
    const sanitizedText = this.messageSanitizer.sanitizeResponse(text.trim());
    const finalMessage = sanitizedText || this.getDefaultMessageForIntent(intent);

    return {
      message: finalMessage,
      intent,
      extractedOrder,
      extractedOrders,
      extractedModifications,
      suggestedActions,
    };
  }

  /**
   * Processes a single function call from Gemini's response.
   */
  private processFunctionCall(fc: FunctionCall): FunctionCallResult {
    const { name, args } = fc;

    const result: FunctionCallResult = {
      functionName: name,
      functionArgs: args,
      result: 'processed',
    };

    switch (name) {
      case 'create_order': {
        const orderInput = args as CreateOrderInput;
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
        const modifyInput = args as ModifyOrderInput;
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
        const removeInput = args as RemoveFromOrderInput;
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
        const searchInput = args as SearchDrinksInput;
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
        const confirmInput = args as ConfirmOrderInput;
        result.suggestedAction = {
          type: 'confirm_order',
          payload: { message: confirmInput.confirmationMessage },
        };
        break;
      }

      case 'cancel_order': {
        const cancelInput = args as CancelOrderInput;
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

      case 'get_full_menu': {
        result.suggestedAction = {
          type: 'get_full_menu',
        };
        break;
      }

      case 'get_drink_details': {
        const detailsInput = args as GetDrinkDetailsInput;
        result.suggestedAction = {
          type: 'get_drink_details',
          payload: { drinkName: detailsInput.drinkName },
        };
        break;
      }

      case 'process_payment': {
        result.suggestedAction = {
          type: 'confirm_order',
          payload: { isPayment: true },
        };
        break;
      }
    }

    return result;
  }

  /**
   * Converts a CreateOrderInput from function calling to our ExtractedOrderItemDto.
   */
  private createOrderInputToExtractedOrderItem(input: CreateOrderInput): ExtractedOrderItemDto {
    let size: DrinkSize | null = null;

    if (input.size) {
      try {
        size = DrinkSize.fromString(input.size);
      } catch {
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
        sweetener: undefined,
        topping: input.customizations?.topping,
      },
      confidence: 0.95,
    };
  }

  /**
   * Maps function names to conversation intents.
   */
  private functionNameToIntent(functionName: string): ConversationIntentType {
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

    return mapping[functionName] || 'unknown';
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
   * Returns a default message when Gemini doesn't provide text.
   */
  private getDefaultMessageForIntent(intent: ConversationIntentType): string {
    const defaults: Record<ConversationIntentType, string> = {
      order_drink: '¡Perfecto! Lo agregué a tu orden. ¿Te gustaría algo más?',
      modify_order: 'Listo, he actualizado tu orden. ¿Algo más que pueda hacer por ti?',
      cancel_order: 'Tu orden ha sido cancelada. ¿Te gustaría ordenar algo diferente?',
      confirm_order: '¡Tu orden está confirmada! Puedes proceder al pago cuando estés listo.',
      process_payment:
        '¡Gracias por tu compra! Tu orden está lista. ¡Que disfrutes tus bebidas! ☕',
      ask_question: '¿En qué más te puedo ayudar?',
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

  /**
   * Generates a streaming response from the barista AI.
   * Yields text chunks as they arrive from Gemini, then processes function calls.
   *
   * @yields Text chunks as they arrive
   * @returns Final response with extracted actions after streaming completes
   */
  async *generateResponseStream(
    input: GenerateResponseInputDto,
  ): AsyncGenerator<string, GenerateResponseOutputDto, unknown> {
    if (!this.initialized) {
      yield 'Lo siento, aún no estoy completamente configurado. Por favor intenta de nuevo en un momento.';
      return this.createErrorResponse(
        'Lo siento, aún no estoy completamente configurado. Por favor intenta de nuevo en un momento.',
      );
    }

    try {
      // Sanitize user message before processing
      const sanitizedMessage = this.messageSanitizer.sanitize(input.userMessage);

      // Build the system prompt with context
      const systemPrompt = buildBaristaSystemPrompt({
        availableDrinks: input.relevantDrinks.map((d) => d.toSummary()),
        currentOrderSummary: input.currentOrderSummary,
        timeOfDay: this.getCurrentTimeOfDay(),
      });

      // Build the contents array from conversation history
      const contents = this.buildContents(sanitizedMessage, input.conversationHistory);

      // Create model with streaming
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: BARISTA_TOOLS }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
        generationConfig: {
          maxOutputTokens: this.maxOutputTokens,
        },
      });

      // Start streaming
      const streamResult = await model.generateContentStream({ contents });

      let fullText = '';
      const functionCalls: FunctionCall[] = [];

      // Stream text chunks
      for await (const chunk of streamResult.stream) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
          if ('text' in part && part.text) {
            fullText += part.text;
            yield part.text; // Yield each text chunk
          }
          if ('functionCall' in part && part.functionCall) {
            functionCalls.push(part.functionCall);
          }
        }
      }

      // Process function calls after streaming completes
      return await this.processResponse({ text: fullText, functionCalls }, input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in streaming response: ${message}`);
      yield 'Estoy teniendo un pequeño problema en este momento. ¿Podrías intentar de nuevo?';
      return this.createErrorResponse(
        'Estoy teniendo un pequeño problema en este momento. ¿Podrías intentar de nuevo?',
      );
    }
  }
}
