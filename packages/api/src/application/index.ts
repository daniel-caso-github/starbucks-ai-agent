/**
 * APPLICATION LAYER
 *
 * Orchestrates the flow of data between the outside world and the domain.
 * Contains use cases that represent business operations.
 *
 * Contains:
 * - Use Cases: Application-specific business rules (ProcessMessageUseCase, CreateOrderUseCase)
 * - Ports: Interfaces that define how the application communicates with the outside world
 *   - Inbound: How the outside world calls us (IProcessMessage)
 *   - Outbound: How we call external services (IOrderRepository, IDrinkSearcher)
 * - DTOs: Data Transfer Objects for input/output validation
 *
 * Rules:
 * - CAN import from domain layer
 * - CANNOT import from infrastructure layer
 * - Defines interfaces (ports) that infrastructure implements
 */

// Common utilities
export * from './common';

// Error types
export * from './errors';

// DTOs
export * from './dtos';

// Ports (interfaces)
export * from './ports';

// Use cases
export * from './use-cases';
