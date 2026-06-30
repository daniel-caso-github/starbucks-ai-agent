/**
 * DOMAIN LAYER
 *
 * This is the core of the application containing business logic.
 * This layer has NO external dependencies (no frameworks, no databases, no APIs).
 *
 * Contains:
 * - Entities: Core business objects with identity (Order, Drink, Conversation)
 * - Value Objects: Immutable objects without identity (OrderId, Money, DrinkSize)
 * - Exceptions: Domain-specific errors (InvalidOrderException, DrinkNotFoundException)
 * - Services: Domain logic that doesn't belong to a single entity (OrderValidator)
 *
 * Rules:
 * - NO imports from application or infrastructure layers
 * - NO imports from external libraries (except validation like Zod)
 * - Pure TypeScript/JavaScript only
 */

export * from './entities';
export * from './value-objects';
export * from './exceptions';
export * from './services';
