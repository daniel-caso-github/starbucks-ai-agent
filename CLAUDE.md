# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Starbucks AI Barista Agent - a conversational AI that simulates a Starbucks barista. Users can explore the drink menu, ask questions in natural language, and place orders through a CLI interface or REST API. The barista responds in Spanish.

## Common Commands

```bash
# Development
pnpm run start:dev          # Start API server with hot reload
pnpm run chat               # Interactive CLI chat with barista

# Database
pnpm run seed               # Populate database with drinks catalog
pnpm run seed:clear         # Clear and repopulate database

# Testing
pnpm test                   # Run unit tests
pnpm test:cov               # Run tests with coverage report
pnpm test:watch             # Run tests in watch mode
pnpm test:e2e               # Run e2e tests (requires docker services)

# Running a single test file
pnpm test -- path/to/file.spec.ts
pnpm test -- --testPathPattern="order.entity"

# Linting & Formatting
pnpm run lint               # ESLint with auto-fix
pnpm run format             # Prettier formatting

# Docker
docker-compose up -d        # Start all services (MongoDB, ChromaDB, Redis, observability)
docker-compose down         # Stop all services
```

## Architecture

**Hexagonal Architecture (Ports & Adapters)** with three layers:

```
src/
├── domain/           # Core business logic (no external dependencies)
│   ├── entities/     # Order, Drink, Conversation
│   ├── value-objects/# Money, DrinkSize, OrderItem, OrderStatus
│   ├── services/     # OrderValidator
│   └── exceptions/   # Domain-specific errors
│
├── application/      # Use cases and port interfaces
│   ├── use-cases/    # ProcessMessage, SearchDrinks, CreateOrder
│   ├── ports/
│   │   ├── inbound/  # Interfaces for external callers
│   │   └── outbound/ # Interfaces for external services
│   ├── dtos/         # Data transfer objects
│   └── common/       # Either pattern for error handling
│
└── infrastructure/   # External adapters (implements ports)
    ├── adapters/
    │   ├── ai/gemini/     # Gemini AI with function calling
    │   ├── ai/openai/     # OpenAI embeddings
    │   └── persistence/
    │       ├── mongodb/   # Repositories, schemas, mappers
    │       └── chromadb/  # Semantic drink search
    ├── cache/        # Redis caching service
    ├── http/         # REST controllers
    └── config/       # Environment configuration
```

## Key Patterns

### Dependency Injection via Ports
Use cases depend on port interfaces, not concrete implementations:
```typescript
constructor(
  @Inject('IConversationRepository') private readonly repo: IConversationRepositoryPort,
  @Inject('IConversationAI') private readonly ai: IConversationAIPort,
)
```

### Either Pattern for Error Handling
Use cases return `Either<ApplicationError, Result>` instead of throwing:
```typescript
async execute(input): Promise<Either<ApplicationError, OutputDto>> {
  if (invalid) return left(new ValidationError());
  return right(result);
}
```

### Path Aliases
```typescript
import { Order } from '@domain/entities';
import { ProcessMessageUseCase } from '@application/use-cases';
import { MongoOrderRepository } from '@infrastructure/adapters/persistence/mongodb';
```

## AI Integration

- **Gemini AI**: Conversation engine using `gemini-2.0-flash` with function calling for structured actions (create_order, modify_order, search_drinks, etc.)
- **OpenAI Embeddings**: `text-embedding-3-small` for semantic search in ChromaDB
- **RAG Pattern**: Relevant drinks are retrieved via semantic search and injected into Gemini's context

The `ProcessMessageUseCase` is the main orchestrator that:
1. Searches relevant drinks (RAG retrieval)
2. Generates AI response with function calling
3. Processes intents and order operations
4. Manages conversation state

## Order Flow States

```
PENDING → CONFIRMED → COMPLETED
    ↓         ↓
    └─────CANCELLED
```

## Testing

- **Unit tests**: `test/unit/` - Mock all dependencies
- **Integration tests**: `test/integration/` - Test with real MongoDB (via mongodb-memory-server)
- **E2E tests**: `test/*.e2e-spec.ts` - Full API tests (require docker services)
- **Coverage threshold**: 80% for statements, functions, lines; 70% for branches

## Environment Variables

Required API keys:
- `GOOGLE_AI_API_KEY` - Gemini for conversation
- `OPENAI_API_KEY` - Embeddings for semantic search

Optional:
- `OTEL_ENABLED` - Enable OpenTelemetry tracing (default: false)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP endpoint (default: http://localhost:4318; Docker uses http://jaeger:4318)

See `.env.example` for full configuration.

## TypeScript Configuration

Strict mode enabled with:
- `strictNullChecks`, `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- Explicit return types required (`@typescript-eslint/explicit-function-return-type`)
- No floating promises (`@typescript-eslint/no-floating-promises`)