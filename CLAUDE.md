# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Starbucks AI Agent — a conversational barista chatbot built with NestJS, Gemini AI (function calling), MongoDB, ChromaDB (vector search), and Redis (caching). The documentation and user-facing messages are in Spanish.

## Commands

### Build & Run
```bash
pnpm build              # Compile TypeScript to dist/
pnpm start:dev          # Development with hot reload
pnpm start:prod         # Production (runs dist/main.js)
```

### Testing
```bash
pnpm test               # Run all unit tests
pnpm test -- --testPathPattern="order.entity"  # Run a single test file by pattern
pnpm test:cov           # Run tests with coverage report
pnpm test:e2e           # End-to-end tests (separate jest config: test/jest-e2e.json)
```

### Linting & Formatting
```bash
pnpm lint               # ESLint with --fix
pnpm format             # Prettier
```

### CLI Tools
```bash
pnpm seed               # Seed MongoDB with drink catalog
pnpm seed:clear         # Clear and reseed
pnpm chat               # Interactive CLI chat
pnpm chroma             # ChromaDB management
```

### Docker
```bash
docker compose up       # All services: app, mongodb, chromadb, redis, monitoring stack
```

## Architecture

**Hexagonal Architecture (Ports & Adapters) with DDD.** The codebase enforces strict layer separation:

```
src/
├── domain/           # Entities, Value Objects, Domain Services, Domain Exceptions
├── application/      # Use Cases, Port interfaces (inbound + outbound), DTOs, Either pattern
├── infrastructure/   # Adapters (AI, MongoDB, ChromaDB, Redis), HTTP controllers, Config, Observability
└── shared/           # Cross-cutting utilities
```

**Dependency rule**: Domain has zero external dependencies. Application depends only on Domain. Infrastructure implements port interfaces and depends on everything.

### Path Aliases
Configured in both `tsconfig.json` and `jest.config.js`:
- `@domain/*` → `src/domain/*`
- `@application/*` → `src/application/*`
- `@infrastructure/*` → `src/infrastructure/*`
- `@shared/*` → `src/shared/*`

### Key Patterns

- **Ports**: Inbound ports (`src/application/ports/inbound/`) define use case interfaces. Outbound ports (`src/application/ports/outbound/`) define repository/service contracts (IConversationAI, IDrinkSearcher, IEmbeddingGenerator, repositories).
- **Either pattern** (`src/application/common/either.ts`): Use cases return `Either<Error, Success>` instead of throwing exceptions.
- **Entity factories**: Domain entities use static `create()` (validates and creates new) and `reconstitute()` (rebuilds from persistence) methods.
- **Value Objects**: Immutable, self-validating (Money, DrinkSize, OrderId, OrderItem). Create via static factory methods.
- **Order state machine**: `PENDING → CONFIRMED → COMPLETED` or `PENDING/CONFIRMED → CANCELLED`.

### Core Flow

1. HTTP request hits `ConversationController`
2. `ProcessMessageUseCase` orchestrates: validates input → loads conversation context (cache/DB) → semantic search via ChromaDB → calls Gemini AI with function calling tools → processes AI response/intents → updates order state → saves conversation
3. Gemini adapter (`src/infrastructure/adapters/ai/gemini/gemini-conversation.adapter.ts`) is the largest file — handles function calling with 7 tool definitions (create_order, search_drinks, get_drink_details, modify_order, remove_from_order, confirm_order, cancel_order)

### Dependency Injection

NestJS DI wires ports to adapters in `src/infrastructure/http/http.module.ts`. Port interfaces are bound to concrete adapter implementations using custom provider tokens.

## Code Style

- **TypeScript strict mode** with `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`
- **ESLint**: No `any` types, explicit return types required, no floating promises. Test files have relaxed rules (unsafe access allowed, no explicit return types required).
- **Prettier**: 100 char width, single quotes, trailing commas, 2-space tabs, LF line endings
- **Env validation**: Zod schema in `src/infrastructure/config/env.validation.ts` validates all environment variables at startup

## Testing Structure

Tests live in `test/` (not colocated with source):
- `test/unit/` — mirrors `src/` structure. Uses mocks/stubs for all external dependencies.
- `test/integration/` — tests against real services (mongodb-memory-server for Mongo, real ChromaDB/Gemini for integration).
- `test/app.e2e-spec.ts` — end-to-end HTTP tests.

Coverage thresholds: 80% statements/functions/lines, 70% branches.

## Environment Variables

Required (see `.env.example`): `MONGO_URI`, `CHROMA_HOST`, `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY`. Optional: `REDIS_URL` (defaults to `redis://localhost:6379`), `PORT` (defaults to 3000), `NODE_ENV`.
