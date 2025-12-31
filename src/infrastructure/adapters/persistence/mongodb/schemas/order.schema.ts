import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mongoose subdocument for drink customizations.
 */
@Schema({ _id: false })
export class CustomizationsDocument {
  @Prop()
  milk?: string;

  @Prop()
  syrup?: string;

  @Prop()
  sweetener?: string;

  @Prop()
  topping?: string;
}

/**
 * Mongoose subdocument for order items.
 */
@Schema({ _id: false })
export class OrderItemDocument {
  @Prop({ required: true })
  drinkId!: string;

  @Prop({ required: true })
  drinkName!: string;

  @Prop({ type: String, default: null })
  size!: string | null;

  @Prop({ required: true, min: 1, max: 10 })
  quantity!: number;

  @Prop({ required: true })
  unitPriceCents!: number;

  @Prop({ required: true })
  currency!: string;

  @Prop({ type: CustomizationsDocument, default: {} })
  customizations!: CustomizationsDocument;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItemDocument);

/**
 * Mongoose document for Order entity.
 * This is the MongoDB representation of the domain Order.
 */
@Schema({
  collection: 'orders',
  timestamps: true,
  _id: false, // Disable auto ObjectId, we use custom string _id
})
export class OrderDocument {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true })
  status!: string;

  @Prop({ type: [OrderItemDocument], default: [] })
  items!: OrderItemDocument[];

  @Prop({ required: true })
  conversationId!: string;

  // Managed by timestamps: true
  createdAt!: Date;

  // Managed by timestamps: true
  updatedAt!: Date;
}

export type OrderDocumentType = HydratedDocument<OrderDocument>;
export const OrderSchema = SchemaFactory.createForClass(OrderDocument);

// Create indexes for common queries
OrderSchema.index({ conversationId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ conversationId: 1, status: 1 });
