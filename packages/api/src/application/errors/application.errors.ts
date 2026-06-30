/**
 * Base class for all application-level errors.
 * These errors represent failures in use case execution,
 * not domain rule violations (which are in the domain layer).
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON(): { code: string; message: string; name: string } {
    return {
      code: this.code,
      message: this.message,
      name: this.name,
    };
  }
}

// ============ Conversation Errors ============

export class ConversationNotFoundError extends ApplicationError {
  readonly code = 'CONVERSATION_NOT_FOUND';
  readonly statusCode = 404;

  constructor(conversationId: string) {
    super(`Conversation with ID '${conversationId}' not found`);
  }
}

export class ConversationCreationError extends ApplicationError {
  readonly code = 'CONVERSATION_CREATION_FAILED';
  readonly statusCode = 500;

  constructor(reason: string) {
    super(`Failed to create conversation: ${reason}`);
  }
}

// ============ Order Errors ============

export class OrderNotFoundError extends ApplicationError {
  readonly code = 'ORDER_NOT_FOUND';
  readonly statusCode = 404;

  constructor(orderId: string) {
    super(`Order with ID '${orderId}' not found`);
  }
}

export class OrderCreationError extends ApplicationError {
  readonly code = 'ORDER_CREATION_FAILED';
  readonly statusCode = 500;

  constructor(reason: string) {
    super(`Failed to create order: ${reason}`);
  }
}

export class OrderAlreadyExistsError extends ApplicationError {
  readonly code = 'ORDER_ALREADY_EXISTS';
  readonly statusCode = 409;

  constructor(conversationId: string) {
    super(`An active order already exists for conversation '${conversationId}'`);
  }
}

export class InvalidOrderStateError extends ApplicationError {
  readonly code = 'INVALID_ORDER_STATE';
  readonly statusCode = 400;

  constructor(orderId: string, currentState: string, attemptedAction: string) {
    super(`Cannot ${attemptedAction} order '${orderId}' in state '${currentState}'`);
  }
}

// ============ Drink Errors ============

export class DrinkNotFoundError extends ApplicationError {
  readonly code = 'DRINK_NOT_FOUND';
  readonly statusCode = 404;

  constructor(identifier: string) {
    super(`Drink '${identifier}' not found`);
  }
}

export class NoMatchingDrinksError extends ApplicationError {
  readonly code = 'NO_MATCHING_DRINKS';
  readonly statusCode = 404;

  constructor(query: string) {
    super(`No drinks found matching '${query}'`);
  }
}

// ============ AI Errors ============

export class AIServiceError extends ApplicationError {
  readonly code = 'AI_SERVICE_ERROR';
  readonly statusCode = 503;

  constructor(service: string, reason: string) {
    super(`${service} service error: ${reason}`);
  }
}

export class AIResponseParsingError extends ApplicationError {
  readonly code = 'AI_RESPONSE_PARSING_ERROR';
  readonly statusCode = 500;

  constructor(reason: string) {
    super(`Failed to parse AI response: ${reason}`);
  }
}

// ============ Validation Errors ============

export class ValidationError extends ApplicationError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, public readonly field?: string) {
    super(message);
  }
}

export class EmptyMessageError extends ValidationError {
  constructor() {
    super('Message cannot be empty', 'message');
  }
}

// ============ Generic Errors ============

export class UnexpectedError extends ApplicationError {
  readonly code = 'UNEXPECTED_ERROR';
  readonly statusCode = 500;

  constructor(reason: string) {
    super(`An unexpected error occurred: ${reason}`);
  }
}

// Type union for all application errors (useful for type narrowing)
export type ProcessMessageError =
  | ConversationNotFoundError
  | ConversationCreationError
  | AIServiceError
  | ValidationError
  | UnexpectedError;

export type OrderError =
  | OrderNotFoundError
  | OrderCreationError
  | OrderAlreadyExistsError
  | InvalidOrderStateError
  | DrinkNotFoundError
  | ValidationError
  | UnexpectedError;

export type SearchError =
  | NoMatchingDrinksError
  | AIServiceError
  | ValidationError
  | UnexpectedError;
