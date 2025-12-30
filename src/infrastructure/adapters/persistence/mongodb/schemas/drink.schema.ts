import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mongoose subdocument for customization options.
 */
@Schema({ _id: false })
export class CustomizationOptionsDocument {
  @Prop({ default: false })
  milk!: boolean;

  @Prop({ default: false })
  syrup!: boolean;

  @Prop({ default: false })
  sweetener!: boolean;

  @Prop({ default: false })
  topping!: boolean;

  @Prop({ default: false })
  size!: boolean;
}

/**
 * Mongoose document for Drink entity.
 * Represents a drink in the Starbucks menu.
 */
@Schema({
  collection: 'drinks',
  timestamps: true,
})
export class DrinkDocument {
  @Prop({ required: true, unique: true })
  _id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  basePriceCents!: number;

  @Prop({ required: true, default: 'USD' })
  currency!: string;

  @Prop({ type: CustomizationOptionsDocument, default: {} })
  customizationOptions!: CustomizationOptionsDocument;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export type DrinkDocumentType = HydratedDocument<DrinkDocument>;
export const DrinkSchema = SchemaFactory.createForClass(DrinkDocument);

// Index for name searches
DrinkSchema.index({ name: 1 });
DrinkSchema.index({ name: 'text', description: 'text' });
