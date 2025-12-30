import { Order } from '@domain/entities';
import { DrinkId, DrinkSize, Money, OrderId, OrderItem, OrderStatus } from '@domain/value-objects';
import { CustomizationsDocument, OrderDocument, OrderItemDocument } from '../schemas';

/**
 * Mapper for converting between Order domain entity and MongoDB document.
 * This class handles the translation between the rich domain model
 * and the flat document structure used by MongoDB.
 */
export class OrderMapper {
  /**
   * Converts a MongoDB document to a domain Order entity.
   * Used when loading data from the database.
   */
  static toDomain(document: OrderDocument): Order {
    const items = document.items.map((item) => this.itemToDomain(item));

    return Order.reconstitute({
      id: OrderId.fromString(document._id),
      status: OrderStatus.fromString(document.status),
      items,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }

  /**
   * Converts a domain Order entity to a MongoDB document.
   * Used when saving data to the database.
   */
  static toDocument(order: Order, conversationId: string): OrderDocument {
    const document = new OrderDocument();
    document._id = order.id.toString();
    document.status = order.status.toString();
    document.items = order.items.map((item) => this.itemToDocument(item));
    document.conversationId = conversationId;
    document.createdAt = order.createdAt;
    document.updatedAt = order.updatedAt;
    return document;
  }

  /**
   * Converts a MongoDB order item subdocument to domain OrderItem.
   */
  private static itemToDomain(document: OrderItemDocument): OrderItem {
    return OrderItem.create({
      drinkId: DrinkId.fromString(document.drinkId),
      drinkName: document.drinkName,
      size: document.size ? DrinkSize.fromString(document.size) : null,
      quantity: document.quantity,
      unitPrice: Money.fromCents(document.unitPriceCents, document.currency),
      customizations: {
        milk: document.customizations?.milk,
        syrup: document.customizations?.syrup,
        sweetener: document.customizations?.sweetener,
        topping: document.customizations?.topping,
      },
    });
  }

  /**
   * Converts a domain OrderItem to MongoDB subdocument.
   */
  private static itemToDocument(item: OrderItem): OrderItemDocument {
    const document = new OrderItemDocument();
    document.drinkId = item.drinkId.toString();
    document.drinkName = item.drinkName;
    document.size = item.size?.toString() ?? null;
    document.quantity = item.quantity;
    document.unitPriceCents = item.unitPrice.cents;
    document.currency = item.unitPrice.currency;
    document.customizations = this.customizationsToDocument(item.customizations);
    return document;
  }

  /**
   * Converts customizations to MongoDB subdocument.
   */
  private static customizationsToDocument(
    customizations: OrderItem['customizations'],
  ): CustomizationsDocument {
    const document = new CustomizationsDocument();
    document.milk = customizations.milk;
    document.syrup = customizations.syrup;
    document.sweetener = customizations.sweetener;
    document.topping = customizations.topping;
    return document;
  }
}
