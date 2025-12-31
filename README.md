# Starbucks AI Agent

Agente conversacional de IA que simula un barista de Starbucks. Permite a los usuarios explorar el menú de bebidas, hacer preguntas en lenguaje natural y realizar pedidos a través de una interfaz conversacional.

## Características Principales

- **Chat Interactivo**: Conversa con el barista AI en español a través de la terminal. Ordena bebidas, modifica tu orden y procede al pago de forma natural.

- **Órdenes Múltiples**: Ordena varias bebidas en un solo mensaje (ej: "quiero un latte y dos cappuccinos").

- **Búsqueda Semántica**: Encuentra bebidas usando lenguaje natural (ej: "algo frío y refrescante", "bebida de otoño"). Utiliza embeddings de OpenAI y ChromaDB para entender el significado detrás de las consultas.

- **Conversación con IA**: Interactúa con Claude AI para procesar mensajes, recomendar bebidas y guiar el proceso de pedido.

- **Gestión de Pedidos**: Crea y gestiona pedidos con opciones de personalización como tamaño, tipo de leche, jarabes y toppings.

- **Persistencia de Datos**: Almacena órdenes, conversaciones y catálogo de bebidas en MongoDB. Los vectores de búsqueda se almacenan en ChromaDB.

## Chat con el Barista

Inicia una conversación interactiva con el barista AI:

```bash
pnpm run chat
```

### Flujo de una Orden

```
👤 You: Hola, quiero un latte grande y un cappuccino
🧑‍🍳 Barista: ¡Perfecto! Te agrego un Caffè Latte grande y un Cappuccino...
   [Orden: 2 item(s) - $9.50 - Estado: pending]

👤 You: confirmar mi orden
🧑‍🍳 Barista: Tu orden está confirmada...
   [Orden: 2 item(s) - $9.50 - Estado: confirmed]

👤 You: proceder al pago
🧑‍🍳 Barista: ¡Gracias por tu compra! Tu orden está lista...
```

### Comandos del Chat

| Comando | Descripción |
|---------|-------------|
| `salir` | Terminar la conversación |
| `limpiar` | Iniciar nueva conversación |
| `orden` | Mostrar detalles de la orden actual |
| `debug` | Mostrar información de depuración |

### Ejemplos de Interacción

```
# Ordenar bebidas
"Quiero un americano grande"
"Dame dos lattes con leche de avena"
"Un chocolate caliente y un cappuccino por favor"

# Modificar orden
"Cambia el latte a tamaño venti"
"Quita el cappuccino"
"Agrega un shot extra al americano"

# Preguntar sobre el menú
"¿Qué bebidas frías tienen?"
"¿Cuál es su bebida más popular?"
"Recomiéndame algo con caramelo"

# Confirmar y pagar
"Confirmar mi orden"
"Proceder al pago"
```

## Arquitectura

El proyecto implementa **Arquitectura Hexagonal** (Ports & Adapters) con principios de Domain-Driven Design:

```
┌─────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │
│  │  HTTP     │  │  MongoDB  │  │  ChromaDB │  │    AI     │     │
│  │Controllers│  │  Repos    │  │  Adapter  │  │ Adapters  │     │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘     │
│        │              │              │              │           │
│        ▼              ▼              ▼              ▼           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    PORTS (Interfaces)                   │    │
│  │         Inbound Ports          Outbound Ports           │    │
│  └─────────────────────────┬───────────────────────────────┘    │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                      Use Cases                            │   │
│  │  ProcessMessage │ SearchDrinks │ CreateOrder │ GetHistory │   │
│  └─────────────────────────┬─────────────────────────────────┘   │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DOMAIN                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │  Entities   │  │Value Objects│  │  Domain Services    │      │
│  │ Order,Drink │  │ Money,Size  │  │  OrderValidator     │      │
│  │ Conversation│  │ DrinkId     │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

| Capa | Responsabilidad |
|------|-----------------|
| **Domain** | Entidades (Order, Drink, Conversation), Value Objects y reglas de negocio. Sin dependencias externas. |
| **Application** | Casos de uso, puertos (interfaces) y DTOs. Orquesta el dominio. |
| **Infrastructure** | Adaptadores para MongoDB, ChromaDB, Claude AI y OpenAI. Implementa los puertos. |

### Reglas de Dependencia

El dominio es el núcleo y no depende de nada externo. La aplicación depende solo del dominio. La infraestructura implementa las interfaces definidas por la aplicación.

## Requisitos

- Node.js 20+
- pnpm
- Docker y Docker Compose
- API Key de OpenAI (para embeddings)
- API Key de Anthropic (para conversación)

## Instalación

1. Clona el repositorio e instala dependencias:

```bash
pnpm install
```

2. Configura las variables de entorno:

```bash
cp .env.example .env
```

3. Edita `.env` y agrega tus API keys:

| Variable | Descripción |
|----------|-------------|
| `MONGO_URI` | URI de conexión a MongoDB |
| `CHROMA_HOST` | URL del servidor ChromaDB |
| `ANTHROPIC_API_KEY` | API key de Anthropic para Claude |
| `OPENAI_API_KEY` | API key de OpenAI para embeddings |

4. Inicia los servicios con Docker:

```bash
docker-compose up -d
```

5. Ejecuta el seed para poblar la base de datos con bebidas:

```bash
pnpm run seed
```

6. Inicia el chat con el barista:

```bash
pnpm run chat
```

## Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm run chat` | Inicia el chat interactivo con el barista AI |
| `pnpm run start:dev` | Inicia la aplicación en modo desarrollo |
| `pnpm run seed` | Pobla la base de datos con el catálogo de bebidas |
| `pnpm run seed:clear` | Limpia y vuelve a poblar la base de datos |
| `pnpm run search:test` | Prueba la búsqueda semántica con ejemplos |
| `pnpm run chroma` | Lista las colecciones de ChromaDB |
| `pnpm run chroma:drinks` | Muestra los items de la colección drinks |
| `pnpm test` | Ejecuta los tests unitarios |
| `pnpm test:cov` | Ejecuta tests con reporte de cobertura |

## Servicios Docker

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| app | 3000 | Aplicación NestJS |
| mongodb | 27017 | Base de datos MongoDB |
| chromadb | 8000 | Base de datos vectorial (API REST) |
| mongo-express | 8081 | UI web para MongoDB (admin/admin) |

## Tech Stack

- **Backend**: NestJS 10, TypeScript 5
- **Base de Datos**: MongoDB 7, ChromaDB
- **IA**: Claude (Anthropic) para conversación, OpenAI para embeddings
- **Testing**: Jest con 80% de cobertura mínima
- **Contenedores**: Docker, Docker Compose

## Estructura del Proyecto

```
src/
├── domain/           # Entidades, Value Objects y excepciones
├── application/      # Casos de uso, puertos y DTOs
├── infrastructure/   # Adaptadores (MongoDB, ChromaDB, AI)
└── shared/           # Utilidades compartidas
```

## Flujo de Estados de una Orden

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

## Licencia

MIT
