# Starbucks AI Agent

Agente conversacional de IA que simula un barista de Starbucks. Permite a los usuarios explorar el menú de bebidas, hacer preguntas en lenguaje natural y realizar pedidos a través de una interfaz conversacional (CLI) o API REST.

## Tabla de Contenidos

- [Características Principales](#características-principales)
- [Demo del Chat](#demo-del-chat)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Instalación](#instalación)
- [Uso](#uso)
- [API REST](#api-rest)
- [Sistema de Caching](#sistema-de-caching)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Testing](#testing)

---

## Características Principales

### Conversación con IA
- **Gemini AI**: Motor de conversación que procesa mensajes, recomienda bebidas y guía el proceso de pedido
- **Respuestas Conversacionales**: El barista responde en español de forma natural y amigable
- **Detección de Intención**: Identifica automáticamente si el usuario quiere ordenar, modificar, confirmar o preguntar

### Gestión de Pedidos
- **Órdenes Múltiples**: Ordena varias bebidas en un solo mensaje (ej: "quiero un latte y dos cappuccinos")
- **Personalización**: Soporte para tamaño, tipo de leche, jarabes y toppings
- **Traducción Automática**: Entiende bebidas en español (ej: "chocolate caliente" → "Hot Chocolate")
- **Cantidades**: Maneja cantidades automáticamente (ej: "dame dos americanos")

### Búsqueda Semántica (RAG)
- **ChromaDB**: Base de datos vectorial para búsqueda semántica de bebidas
- **OpenAI Embeddings**: Genera embeddings para entender el significado de las consultas
- **Búsqueda Inteligente**: Encuentra bebidas usando lenguaje natural (ej: "algo frío y refrescante")

### Persistencia y Cache
- **MongoDB**: Almacena órdenes, conversaciones y catálogo de bebidas
- **Redis Cache**: Capa de caching para optimizar rendimiento (70% mejora en respuestas)
- **Cache Inteligente**: TTLs configurados por tipo de dato

### API REST
- **Endpoints RESTful**: API completa para integración con aplicaciones
- **Swagger/OpenAPI**: Documentación interactiva de la API
- **Streaming**: Soporte para respuestas en streaming (SSE)

---

## Demo del Chat

### Flujo Completo de una Orden

```
☕ ¡Bienvenido al Chat del Barista AI de Starbucks!
═══════════════════════════════════════════════════════

🧑‍🍳 Barista: ¡Hola! ¡Bienvenido a Starbucks! ¿Qué te puedo ofrecer hoy?

👤 You: quiero ver las bebidas disponibles

🧑‍🍳 Barista: ☕ **NUESTRO MENÚ DE BEBIDAS**

**Café Espresso:**
• Americano - $3.75
• Caffè Latte - $4.75
• Cappuccino - $4.75
• Caramel Macchiato - $5.25
...

👤 You: puedes darme detalles del Americano

🧑‍🍳 Barista: Claro que sí. El Americano es una bebida hecha con espresso
y agua caliente. Es una opción simple pero deliciosa para los amantes
del café. ¿Te gustaría probarlo?

👤 You: si, y también dame un latte grande

🧑‍🍳 Barista: ¡Perfecto! Lo agregué a tu orden. ¿Te gustaría algo más?
   [Orden: 2 item(s) - $8.50 - Estado: pending]

👤 You: eso sería todo

🧑‍🍳 Barista: ¡Entendido! Tu orden es: 1 Americano y 1 Caffè Latte (grande).
¿Es correcto?
   [Orden: 2 item(s) - $8.50 - Estado: confirmed]

👤 You: si, quiero pagar

🧑‍🍳 Barista: ¡Claro! Procesando el pago... ¡Muchas gracias por tu compra! ☕
```

### Comandos del Chat

| Comando | Descripción |
|---------|-------------|
| `salir` o `exit` | Terminar la conversación |
| `limpiar` | Iniciar nueva conversación |
| `orden` | Mostrar detalles de la orden actual |
| `debug` | Mostrar información de depuración |

### Ejemplos de Interacción

```bash
# Ordenar bebidas
"Quiero un americano grande"
"Dame dos lattes con leche de avena"
"Un chocolate caliente y un cappuccino por favor"

# Modificar orden
"Cambia el latte a tamaño venti"
"Quita el cappuccino"
"Agrega un shot extra al americano"

# Preguntar sobre el menú
"Quiero ver el menú"
"¿Qué bebidas frías tienen?"
"Dame detalles del Mocha"

# Confirmar y pagar
"Eso sería todo"
"Confirmar mi orden"
"Proceder al pago"
```

---

## Arquitectura

El proyecto implementa **Arquitectura Hexagonal** (Ports & Adapters) con principios de Domain-Driven Design:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────┐  │
│  │   HTTP    │  │  MongoDB  │  │  ChromaDB │  │  Gemini   │  │ Redis │  │
│  │Controllers│  │   Repos   │  │  Searcher │  │    AI     │  │ Cache │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───┬───┘  │
│        │              │              │              │            │      │
│        ▼              ▼              ▼              ▼            ▼      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      PORTS (Interfaces)                         │    │
│  │           Inbound Ports              Outbound Ports             │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         Use Cases                                │    │
│  │  ProcessMessage │ SearchDrinks │ CreateOrder │ GetHistory       │    │
│  └───────────────────────────┬─────────────────────────────────────┘    │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              DOMAIN                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐              │
│  │  Entities   │  │Value Objects │  │  Domain Services   │              │
│  │ Order,Drink │  │ Money, Size  │  │  OrderValidator    │              │
│  │ Conversation│  │ DrinkId      │  │                    │              │
│  └─────────────┘  └──────────────┘  └────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Capas

| Capa | Responsabilidad |
|------|-----------------|
| **Domain** | Entidades (Order, Drink, Conversation), Value Objects (Money, DrinkSize) y reglas de negocio. Sin dependencias externas. |
| **Application** | Casos de uso, puertos (interfaces) y DTOs. Orquesta el dominio. |
| **Infrastructure** | Adaptadores para MongoDB, ChromaDB, Redis, Gemini AI y OpenAI. Implementa los puertos. |

### Flujo de Estados de una Orden

```
┌─────────┐     confirmar      ┌───────────┐      pagar       ┌───────────┐
│ PENDING │ ─────────────────► │ CONFIRMED │ ───────────────► │ COMPLETED │
└─────────┘                    └───────────┘                  └───────────┘
     │                              │
     │         cancelar             │        cancelar
     └──────────────┬───────────────┘
                    ▼
              ┌───────────┐
              │ CANCELLED │
              └───────────┘
```

---

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| **Backend** | NestJS 10, TypeScript 5 |
| **Base de Datos** | MongoDB 7 |
| **Vector DB** | ChromaDB |
| **Cache** | Redis |
| **IA - Conversación** | Google Gemini (gemini-2.0-flash-lite) |
| **IA - Embeddings** | OpenAI (text-embedding-3-small) |
| **Documentación** | Swagger / OpenAPI |
| **Testing** | Jest (80% cobertura mínima) |
| **Contenedores** | Docker, Docker Compose |
| **Monitoreo** | Prometheus, Grafana, Loki |

---

## Instalación

### Requisitos

- Node.js 20+
- pnpm
- Docker y Docker Compose
- API Key de OpenAI (para embeddings)
- API Key de Google AI (para conversación)

### Pasos

1. **Clona el repositorio e instala dependencias:**

```bash
git clone <repository-url>
cd starbucks-ai-agent
pnpm install
```

2. **Configura las variables de entorno:**

```bash
cp .env.example .env
```

3. **Edita `.env` con tus configuraciones:**

```env
# Base de Datos
MONGO_URI=mongodb://admin:password@localhost:27017/starbucks?authSource=admin

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys
GOOGLE_AI_API_KEY=tu_api_key_de_google
OPENAI_API_KEY=tu_api_key_de_openai
```

4. **Inicia los servicios con Docker:**

```bash
docker-compose up -d
```

5. **Ejecuta el seed para poblar la base de datos:**

```bash
pnpm run seed
```

6. **Inicia el chat o el servidor:**

```bash
# Chat interactivo
pnpm run chat

# Servidor API
pnpm run start:dev
```

---

## Uso

### Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm run chat` | Inicia el chat interactivo con el barista AI |
| `pnpm run start:dev` | Inicia el servidor API en modo desarrollo |
| `pnpm run start:prod` | Inicia el servidor en modo producción |
| `pnpm run seed` | Pobla la base de datos con el catálogo de bebidas |
| `pnpm run seed:clear` | Limpia y vuelve a poblar la base de datos |
| `pnpm run chroma` | Lista las colecciones de ChromaDB |
| `pnpm run chroma:drinks` | Muestra los items de la colección drinks |
| `pnpm test` | Ejecuta los tests unitarios |
| `pnpm test:cov` | Ejecuta tests con reporte de cobertura |

### Servicios Docker

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| app | 3000 | Aplicación NestJS |
| mongodb | 27017 | Base de datos MongoDB |
| chromadb | 8000 | Base de datos vectorial |
| redis | 6379 | Cache Redis |
| mongo-express | 8081 | UI web para MongoDB |
| prometheus | 9090 | Métricas |
| grafana | 3001 | Dashboards |

---

## API REST

### Endpoints Principales

La API está documentada con Swagger en: `http://localhost:3000/api/docs`

#### Conversaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/conversations/message` | Enviar mensaje al barista |
| `POST` | `/api/v1/conversations/message/stream` | Enviar mensaje (streaming) |
| `GET` | `/api/v1/conversations/:id` | Obtener conversación |

#### Bebidas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/drinks` | Listar todas las bebidas |
| `GET` | `/api/v1/drinks/:id` | Obtener bebida por ID |
| `GET` | `/api/v1/drinks/search?q=` | Buscar bebidas |

#### Órdenes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/orders/:id` | Obtener orden por ID |

#### Health Check

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Estado del servicio |
| `GET` | `/metrics` | Métricas Prometheus |

### Ejemplo de Uso

```bash
# Enviar mensaje
curl -X POST http://localhost:3000/api/v1/conversations/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Quiero un latte grande"}'

# Respuesta
{
  "response": "¡Perfecto! Te agregué un Caffè Latte grande. ¿Algo más?",
  "conversationId": "conv_abc123",
  "intent": "order_drink",
  "currentOrder": {
    "orderId": "ord_xyz789",
    "status": "pending",
    "items": [
      {
        "drinkName": "Caffè Latte",
        "size": "grande",
        "quantity": 1,
        "price": "$4.75"
      }
    ],
    "totalPrice": "$4.75"
  }
}
```

---

## Sistema de Caching

El sistema utiliza **Redis** como backend de cache con estrategia **cache-aside** para optimizar el rendimiento.

### Arquitectura de Cache

```
┌─────────────┐     Cache Miss      ┌─────────────┐
│   Cliente   │ ──────────────────► │   MongoDB   │
│             │                     │  /ChromaDB  │
└──────┬──────┘                     └──────┬──────┘
       │                                   │
       │ Cache Hit                         │ Resultado
       │                                   │
       ▼                                   ▼
┌─────────────┐                     ┌─────────────┐
│    Redis    │ ◄─────────────────  │   Guardar   │
│    Cache    │      en Cache       │   en Cache  │
└─────────────┘                     └─────────────┘
```

### Tipos de Cache

| Tipo | Cache Key | TTL | Descripción |
|------|-----------|-----|-------------|
| **Historial de Conversación** | `conv:{id}:history` | 30 min | Mensajes de la conversación |
| **Orden Activa** | `conv:{id}:order` | 15 min | Orden pendiente del usuario |
| **Contexto** | `conv:{id}:context` | 10 min | Intención y estado actual |
| **Búsqueda de Bebidas** | `drinks:search:{hash}` | 1 hora | Resultados de búsqueda semántica |
| **Catálogo Completo** | `drinks:all` | 24 horas | Todas las bebidas del menú |

### Beneficios de Performance

- **~70% mejora** en tiempo de respuesta para consultas cacheadas
- **Reducción de llamadas a OpenAI** para embeddings repetidos
- **Optimización de queries a MongoDB** con contexto cacheado
- **Catálogo en cache 24h** - solo 1 query diaria a ChromaDB

### TTLs Configurados

```typescript
CACHE_TTL = {
  CONVERSATION_HISTORY: 1800,  // 30 minutos
  ACTIVE_ORDER: 900,           // 15 minutos
  CONVERSATION_CONTEXT: 600,   // 10 minutos
  DRINKS_SEARCH: 3600,         // 1 hora
  DRINKS_ALL: 86400,           // 24 horas
}
```

---

## Estructura del Proyecto

```
src/
├── domain/                    # Capa de Dominio
│   ├── entities/              # Entidades (Order, Drink, Conversation)
│   ├── value-objects/         # Value Objects (Money, DrinkSize, OrderItem)
│   ├── services/              # Servicios de Dominio (OrderValidator)
│   └── exceptions/            # Excepciones de Dominio
│
├── application/               # Capa de Aplicación
│   ├── use-cases/             # Casos de Uso
│   │   ├── process-message.use-case.ts
│   │   ├── search-drinks.use-case.ts
│   │   └── get-conversation-history.use-case.ts
│   ├── ports/                 # Interfaces (Puertos)
│   │   ├── inbound/           # Puertos de entrada
│   │   └── outbound/          # Puertos de salida
│   ├── dtos/                  # Data Transfer Objects
│   ├── errors/                # Errores de Aplicación
│   └── common/                # Utilidades (Either pattern)
│
├── infrastructure/            # Capa de Infraestructura
│   ├── adapters/
│   │   ├── ai/
│   │   │   ├── gemini/        # Adaptador Gemini AI
│   │   │   │   ├── prompts/   # System prompts
│   │   │   │   ├── tools/     # Function calling tools
│   │   │   │   └── services/  # Sanitización de mensajes
│   │   │   └── openai/        # Adaptador OpenAI Embeddings
│   │   └── persistence/
│   │       ├── mongodb/       # Repositorios MongoDB
│   │       └── chromadb/      # Buscador ChromaDB
│   ├── cache/                 # Servicio de Cache Redis
│   ├── config/                # Configuración de entorno
│   ├── database/              # Seeds y migraciones
│   └── http/                  # Controllers y DTOs HTTP
│
└── shared/                    # Utilidades compartidas
```

---

## Testing

### Ejecutar Tests

```bash
# Tests unitarios
pnpm test

# Tests con cobertura
pnpm test:cov

# Tests en modo watch
pnpm test:watch
```

### Cobertura

El proyecto mantiene un mínimo de **80% de cobertura** en:
- Statements
- Branches
- Functions
- Lines

### Estructura de Tests

```
test/
├── unit/
│   ├── domain/                # Tests de entidades y value objects
│   ├── application/           # Tests de use cases
│   └── infrastructure/        # Tests de adaptadores
└── integration/
    ├── chromadb/              # Tests de integración ChromaDB
    └── mongodb/               # Tests de integración MongoDB
```

---

## Monitoreo

### Prometheus Metrics

Disponible en: `http://localhost:9090`

Métricas expuestas:
- Requests HTTP (count, duration)
- Uso de cache (hits/misses)
- Tiempos de respuesta de AI
- Estado de conexiones a BD

### Grafana Dashboards

Disponible en: `http://localhost:3001`

- Dashboard de API Performance
- Dashboard de Cache Statistics
- Dashboard de AI Response Times

### Loki (Logs)

Agregación centralizada de logs con Loki y visualización en Grafana.

---

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | development |
| `PORT` | Puerto del servidor | 3000 |
| `MONGO_URI` | URI de conexión MongoDB | - |
| `CHROMA_HOST` | Host de ChromaDB | localhost |
| `CHROMA_PORT` | Puerto de ChromaDB | 8000 |
| `REDIS_HOST` | Host de Redis | localhost |
| `REDIS_PORT` | Puerto de Redis | 6379 |
| `GOOGLE_AI_API_KEY` | API Key de Google AI | - |
| `OPENAI_API_KEY` | API Key de OpenAI | - |

---

## Licencia

MIT
