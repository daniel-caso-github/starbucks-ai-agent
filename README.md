# Starbucks AI Agent

An AI-powered Starbucks barista agent built with NestJS, Claude AI, MongoDB, and ChromaDB. Uses hexagonal architecture and Domain-Driven Design principles.

## 🏗️ Architecture

This project follows **Hexagonal Architecture** (Ports & Adapters) with clear separation of concerns:
```
src/
├── domain/                 # 🎯 Core business logic (NO external dependencies)
│   ├── entities/           # Order, Drink, Conversation
│   ├── value-objects/      # OrderId, Money, DrinkSize, etc.
│   ├── exceptions/         # Domain-specific errors
│   └── services/           # Domain services (OrderValidatorService)
│
├── application/            # 🔄 Use cases and ports (coming in Phase 3)
│   ├── ports/
│   │   ├── inbound/        # Interfaces for incoming requests
│   │   └── outbound/       # Interfaces for external services
│   ├── use-cases/          # Application business logic
│   └── dtos/               # Data transfer objects
│
├── infrastructure/         # 🔌 External implementations (coming in Phase 4)
│   ├── adapters/
│   │   ├── persistence/    # MongoDB, ChromaDB implementations
│   │   ├── ai/             # Claude AI adapter
│   │   └── http/           # REST controllers
│   └── config/             # Environment configuration
│
└── shared/                 # 🛠️ Cross-cutting utilities
```

### Dependency Rules

- ❌ Domain CANNOT import from Application or Infrastructure
- ❌ Application CANNOT import from Infrastructure
- ✅ Infrastructure CAN import from Application and Domain
- ✅ Application CAN import from Domain

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose

### Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/starbucks-ai-agent.git
cd starbucks-ai-agent

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start services with Docker
docker-compose up -d

# Run the application
pnpm run start:dev
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://mongodb:27017/starbucks_agent
CHROMA_HOST=http://chromadb:8000
ANTHROPIC_API_KEY=your_api_key_here
```

## 🧪 Testing

### Conventions

We use **co-location** with `__tests__` folders:
```
src/domain/value-objects/
├── __tests__/
│   ├── money.vo.spec.ts
│   └── order-id.vo.spec.ts
├── money.vo.ts
└── order-id.vo.ts
```

### Commands
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test --coverage

# Run tests in watch mode
pnpm test:watch

# Run specific folder tests
pnpm test src/domain/

# Run e2e tests
pnpm run test:e2e
```

### Coverage Thresholds

We enforce **80% minimum coverage** for:
- Statements
- Branches
- Functions
- Lines

## 📝 Code Conventions

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `*.entity.ts` | `order.entity.ts` |
| Value Object | `*.vo.ts` | `money.vo.ts` |
| Exception | `*.exception.ts` | `invalid-order.exception.ts` |
| Service | `*.service.ts` | `order-validator.service.ts` |
| Test | `*.spec.ts` | `money.vo.spec.ts` |
| E2E Test | `*.e2e-spec.ts` | `app.e2e-spec.ts` |


## 🐳 Docker

### Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 | NestJS application |
| mongodb | 27017 | MongoDB database |
| chromadb | 8000 | Vector database for RAG |


## 🛠️ Tech Stack

- **Runtime**: Node.js 20, TypeScript 5
- **Framework**: NestJS 10
- **Database**: MongoDB 7
- **Vector DB**: ChromaDB
- **AI**: Claude (Anthropic)
- **Testing**: Jest
- **Container**: Docker

## 📄 License

Nest is [MIT licensed](LICENSE).