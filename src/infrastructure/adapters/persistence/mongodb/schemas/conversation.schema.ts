import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mongoose subdocument for individual messages in a conversation.
 */
@Schema({ _id: false })
export class MessageDocument {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true })
  timestamp!: Date;
}

export const MessageSchema = SchemaFactory.createForClass(MessageDocument);

/**
 * Mongoose document for Conversation entity.
 * Stores the chat history between user and AI barista.
 */
@Schema({
  collection: 'conversations',
  timestamps: true,
})
export class ConversationDocument {
  @Prop({ required: true, unique: true })
  _id!: string;

  @Prop({ type: [MessageDocument], default: [] })
  messages!: MessageDocument[];

  @Prop({ type: String, default: null })
  currentOrderId!: string | null;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export type ConversationDocumentType = HydratedDocument<ConversationDocument>;
export const ConversationSchema = SchemaFactory.createForClass(ConversationDocument);

// Index for quick lookups
ConversationSchema.index({ updatedAt: -1 });
