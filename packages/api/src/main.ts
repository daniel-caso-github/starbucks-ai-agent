// Initialize tracing BEFORE importing other modules
import { initTracing } from '@infrastructure/observability';

// Only initialize tracing in production/docker environment
if (process.env.OTEL_ENABLED === 'true') {
  initTracing('starbucks-barista-ai', '1.0.0');
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable NestJS graceful shutdown hooks
  app.enableShutdownHooks();

  // Enable CORS for frontend applications
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Starbucks AI Barista API')
    .setDescription(
      `REST API for the Starbucks AI Barista Agent.
      
This API allows you to:
- Have conversations with an AI barista to order drinks
- Search the drink menu using natural language
- Manage orders (view, confirm, cancel)

The barista AI understands natural language in English and Spanish.`,
    )
    .setVersion('1.0')
    .addTag('Conversations', 'Interact with the AI barista')
    .addTag('Drinks', 'Browse and search the drink menu')
    .addTag('Orders', 'Manage orders')
    .addTag('Health', 'Application health monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🧑‍🍳 Starbucks AI Barista API Started 🧑‍🍳              ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${port}                         ║
║  Swagger:    http://localhost:${port}/api/docs                ║
║  Health:     http://localhost:${port}/api/v1/health           ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

void bootstrap();
