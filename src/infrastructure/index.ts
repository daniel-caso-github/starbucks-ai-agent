/**
 * INFRASTRUCTURE LAYER
 *
 * Contains all external implementations and framework-specific code.
 * This layer adapts external tools to work with our application.
 *
 * Contains:
 * - Adapters: Implementations of application ports
 *   - Persistence: MongoDB repositories, ChromaDB vector search
 *   - AI: Claude conversation adapter
 *   - HTTP: NestJS controllers
 * - Config: Configuration modules and environment setup
 *
 * Rules:
 * - CAN import from domain and application layers
 * - Implements interfaces defined in application/ports
 * - Contains all framework-specific code (NestJS, Mongoose, etc.)
 */

export * from './adapters';
export * from './config';
