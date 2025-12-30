import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OrderDocument,
  OrderSchema,
  ConversationDocument,
  ConversationSchema,
  DrinkDocument,
  DrinkSchema,
} from './schemas';
import {
  MongoOrderRepository,
  MongoConversationRepository,
  MongoDrinkRepository,
} from './repositories';

/**
 * Module that configures MongoDB persistence layer.
 *
 * This module registers all Mongoose schemas and provides
 * repository implementations that can be injected throughout
 * the application using the port interfaces.
 *
 * @example
 * ```typescript
 * // In a use case or service:
 * constructor(
 *   @Inject('IOrderRepository')
 *   private readonly orderRepository: IOrderRepository,
 * ) {}
 * ```
 */
@Module({
  imports: [
    // Register Mongoose schemas
    MongooseModule.forFeature([
      { name: OrderDocument.name, schema: OrderSchema },
      { name: ConversationDocument.name, schema: ConversationSchema },
      { name: DrinkDocument.name, schema: DrinkSchema },
    ]),
  ],
  providers: [
    // Register repositories with their interface tokens
    {
      provide: 'IOrderRepository',
      useClass: MongoOrderRepository,
    },
    {
      provide: 'IConversationRepository',
      useClass: MongoConversationRepository,
    },
    {
      provide: 'IDrinkRepository',
      useClass: MongoDrinkRepository,
    },
  ],
  exports: [
    // Export tokens so other modules can inject repositories
    'IOrderRepository',
    'IConversationRepository',
    'IDrinkRepository',
  ],
})
export class MongoDBModule {}
