# Starbucks AI Barista Agent

Conversational AI agent that simulates a Starbucks barista. Users can explore the drink menu, ask questions in natural language, and place orders through a real-time chat interface powered by Gemini AI with function calling and SSE streaming.

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Observability](#observability)

---

## Demo

> **Coming soon** — drop a screen recording here once available.
>
> ![Chat demo](docs/demo.gif)

---

## Features

### Conversational AI
- **Gemini 2.0 Flash** with function calling — structured actions (`search_drinks`, `create_order`, `modify_order`, `confirm_order`, `cancel_order`, `get_full_menu`, `get_drink_details`)
- **SSE streaming** — bot text appears word-by-word as it is generated
- Responds in Spanish with natural, friendly barista personality

### Drink Discovery
- **Semantic search** via ChromaDB + OpenAI embeddings (RAG pattern)
- **DrinkCardCarousel** — horizontal card carousel with real drink photos, cold/hot filter and text search
- **MenuModal** — full menu drawer with the same filters; loads all 40+ drinks from MongoDB
- Relevant drinks injected into every Gemini context window for accurate recommendations

### Order Management
- Multi-drink orders in a single message ("quiero un latte y dos cappuccinos")
- Customization: size, milk type, syrup, sweetener, toppings
- Full state machine: `PENDING → CONFIRMED → COMPLETED / CANCELLED`
- **OrderPanel** — live order sidebar with drink thumbnails, quantity controls, confirm/pay/cancel buttons

### UI / UX
- All action buttons `disabled` while the AI is processing to prevent duplicate requests
- 30-second SSE watchdog — resets `typing` state if the stream closes without a `complete` event
- Three responsive layouts: **Desktop** (fixed sidebar) · **Drawer** (slide-in panel) · **Mobile** (bottom sheet)
- Quick reply chips update contextually with the current order state

### Reliability
- `seed:clear` calls `clearIndex()` to wipe the entire ChromaDB collection before re-indexing, eliminating orphan documents that caused duplicate carousel cards
- Contextual fallback messages when Gemini returns only a tool call without text
- Conversation resilience: if a conversation is missing from storage it is recreated transparently

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         packages/web  (React + Vite)                    │
│  ChatColumn · DrinkCardCarousel · MenuModal · OrderPanel · QuickReplies │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │  SSE  /  REST
┌─────────────────────────────────▼───────────────────────────────────────┐
│                         packages/api  (NestJS)                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      INFRASTRUCTURE                               │   │
│  │  HTTP Controllers · MongoDB Repos · ChromaDB · Gemini · Redis    │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                             │ Ports (interfaces)                        │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │                       APPLICATION                                 │   │
│  │  ProcessMessageStream · SearchDrinks · CreateOrder · GetHistory   │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                             │                                           │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │                         DOMAIN                                    │   │
│  │  Order · Drink · Conversation  |  Money · DrinkSize · OrderItem   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      packages/shared  (TypeScript)                      │
│           OrderSummaryDto · DrinkCardDto · ProcessMessageOutputDto      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Order State Machine

```
PENDING ──confirm──► CONFIRMED ──pay──► COMPLETED
   │                     │
   └────cancel────────────┘
              │
              ▼
          CANCELLED
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Zustand |
| **Backend** | NestJS 10, TypeScript 5 |
| **AI — Conversation** | Google Gemini 2.0 Flash (function calling + streaming) |
| **AI — Embeddings** | OpenAI `text-embedding-3-small` |
| **Database** | MongoDB 7 |
| **Vector DB** | ChromaDB |
| **Cache** | Redis |
| **Testing** | Jest (unit + integration), Playwright (E2E) |
| **Containers** | Docker, Docker Compose |
| **Observability** | OpenTelemetry, Prometheus, Grafana, Jaeger |
| **Package Manager** | pnpm workspaces |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker and Docker Compose
- Google AI API key (Gemini)
- OpenAI API key (embeddings)

### Installation

```bash
git clone <repository-url>
cd starbucks-ai-agent
pnpm install
```

### Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_AI_API_KEY=your_google_ai_key
OPENAI_API_KEY=your_openai_key

# Local development
MONGO_URI=mongodb://localhost:27017/starbucks_agent
CHROMA_HOST=http://localhost:8000
REDIS_URL=redis://localhost:6379
```

### Start services

```bash
docker-compose up -d
```

### Seed the database

```bash
pnpm --filter api seed:clear
```

Expected output:
```
✅ Cleared N drinks from DB and full index
✅ Successfully seeded 40 drinks
```

### Run

```bash
# API (hot reload)
pnpm --filter api start:dev

# Web (Vite dev server → http://localhost:5173)
pnpm --filter web dev
```

---

## Commands

### Root workspace

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter api <cmd>` | Run any command inside packages/api |
| `pnpm --filter web <cmd>` | Run any command inside packages/web |

### API (`packages/api`)

| Command | Description |
|---------|-------------|
| `pnpm start:dev` | Start API with hot reload |
| `pnpm seed` | Populate MongoDB + ChromaDB |
| `pnpm seed:clear` | Wipe and re-seed (removes ChromaDB orphans) |
| `pnpm seed:stats` | Print drink catalog stats |
| `pnpm test` | Run unit tests |
| `pnpm test:cov` | Run tests with coverage report |
| `pnpm test:e2e` | Run E2E tests (requires Docker services) |

### Web (`packages/web`)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Production build |
| `pnpm test:e2e` | Run Playwright E2E suite |

### Docker services

| Service | Port | Description |
|---------|------|-------------|
| api | 3000 | NestJS application |
| web | 5173 | React frontend (dev) |
| mongodb | 27017 | MongoDB |
| chromadb | 8000 | Vector database |
| redis | 6379 | Cache |
| mongo-express | 8081 | MongoDB UI |
| jaeger | 16686 | Distributed tracing |
| prometheus | 9090 | Metrics |
| grafana | 3001 | Dashboards |

---

## API Reference

Swagger UI: `http://localhost:3000/api/docs`

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/conversations/message` | Send a message (blocking) |
| `POST` | `/api/v1/conversations/message/stream` | Send a message (SSE stream) |
| `GET` | `/api/v1/conversations/:id` | Get conversation history |

### Drinks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/drinks` | List all drinks |
| `GET` | `/api/v1/drinks/:id` | Get drink by ID |
| `GET` | `/api/v1/drinks/search?q=` | Semantic drink search |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/orders/:id` | Get order by ID |

### Example

```bash
curl -X POST http://localhost:3000/api/v1/conversations/message/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "quiero un latte grande con leche de avena"}'
```

```jsonc
// event: text
// data: "¡Perfecto! Te..."

// event: complete
// data: {
//   "response": "¡Perfecto! Te agregué un Caffè Latte grande con leche de avena.",
//   "conversationId": "conv_abc123",
//   "intent": "order_drink",
//   "currentOrder": {
//     "status": "pending",
//     "items": [{ "drinkName": "Caffè Latte", "size": "grande", "quantity": 1, "price": "$4.75" }],
//     "totalPrice": "$4.75",
//     "canConfirm": true
//   }
// }
```

---

## Project Structure

```
starbucks-ai-agent/
├── packages/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── domain/               # Entities, Value Objects, Domain Services
│   │   │   │   ├── entities/         # Order, Drink, Conversation
│   │   │   │   └── value-objects/    # Money, DrinkSize, OrderItem, OrderStatus
│   │   │   ├── application/          # Use Cases + Ports
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── helpers/      # buildOrderSummary, handleSpecialActions
│   │   │   │   │   └── process-message-stream.use-case.ts
│   │   │   │   └── ports/
│   │   │   │       ├── inbound/
│   │   │   │       └── outbound/     # IDrinkSearcherPort, IOrderRepositoryPort…
│   │   │   └── infrastructure/
│   │   │       ├── adapters/
│   │   │       │   ├── ai/
│   │   │       │   │   ├── gemini/   # Conversation adapter + prompts + tools
│   │   │       │   │   └── openai/   # Embedding adapter
│   │   │       │   └── persistence/
│   │   │       │       ├── mongodb/  # Repositories + schemas + mappers
│   │   │       │       └── chromadb/ # Semantic searcher (clearIndex fix)
│   │   │       ├── cache/            # Redis cache service
│   │   │       ├── database/seeds/   # Drink seeder with CDN images
│   │   │       └── http/             # REST controllers + E2E test helpers
│   │   └── test/
│   │       ├── unit/                 # Jest unit tests
│   │       └── integration/          # MongoDB + ChromaDB integration tests
│   │
│   ├── web/                          # React frontend
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── chat/             # ChatColumn, MessageBubble, QuickReplies…
│   │   │   │   ├── drink-cards/      # DrinkCard, DrinkCardCarousel (+ filters)
│   │   │   │   ├── menu/             # MenuModal (full menu drawer + filters)
│   │   │   │   ├── order/            # OrderPanel with DrinkThumb images
│   │   │   │   ├── shell/            # AppShell, Header, DevToolbar, Layout
│   │   │   │   └── checkout/         # SuccessModal
│   │   │   ├── store/                # Zustand: chat-store, order-store, ui-store
│   │   │   └── lib/api/              # SSE client + REST hooks
│   │   └── e2e/                      # Playwright test suites (a → n)
│   │
│   └── shared/                       # Cross-package TypeScript DTOs
│       └── src/dtos/                 # OrderSummaryDto, DrinkCardDto, etc.
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── pnpm-workspace.yaml
└── .env.example
```

---

## Testing

### Unit & Integration (API)

```bash
pnpm --filter api test          # unit tests
pnpm --filter api test:cov      # with coverage (≥80% threshold)
pnpm --filter api test:e2e      # requires Docker services running
```

### E2E (Web — Playwright)

```bash
pnpm --filter web test:e2e
```

14 test suites covering:

| Suite | Description |
|-------|-------------|
| `a-arranque` | App loads and renders chat |
| `b-conversacion` | Full conversation flow |
| `c-busqueda` | Semantic drink search |
| `d-menu` | Full menu modal |
| `e-personalizacion` | Drink customization |
| `f-cantidades` | Quantity controls |
| `g-estados-orden` | Order state transitions |
| `h-errores` | Error handling and retry |
| `i-drawer-mobile` | Drawer and mobile layouts |
| `j-visual` | Visual regression baseline |
| `k-carousel` | Carousel + filter + search |
| `l-resiliencia` | Conversation resilience after DB reset |
| `m-menu-filtros` | Menu image, search, temp filter, empty state |
| `n-concurrencia` | Buttons disabled during AI processing |

---

## Observability

| Tool | URL | Description |
|------|-----|-------------|
| Swagger | `http://localhost:3000/api/docs` | Interactive API docs |
| Jaeger | `http://localhost:16686` | Distributed tracing (OTEL) |
| Prometheus | `http://localhost:9090` | Metrics scraping |
| Grafana | `http://localhost:3001` | Dashboards (API latency, cache hit rate) |

Enable tracing via `.env`:

```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

---

## License

MIT
