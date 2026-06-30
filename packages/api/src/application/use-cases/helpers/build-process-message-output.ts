import { Order } from '@domain/entities';
import { OrderItemSummaryDto, OrderSummaryDto } from '@application/dtos';

export function buildOrderSummary(order: Order): OrderSummaryDto {
  const items: OrderItemSummaryDto[] = order.items.map((item, idx) => ({
    index: idx + 1,
    drinkName: item.drinkName,
    size: item.size?.toString() ?? null,
    quantity: item.quantity,
    temp: item.isHot ? 'hot' : 'iced',
    imageUrl: item.imageUrl,
    customizations: {
      milk: item.customizations.milk,
      syrup: item.customizations.syrup,
      sweetener: item.customizations.sweetener,
      topping: item.customizations.topping,
    },
    price: item.totalPrice.format(),
  }));

  return {
    orderId: order.id.toString(),
    status: order.status.toString(),
    items,
    totalPrice: order.totalPrice.format(),
    itemCount: order.totalQuantity,
    canConfirm: order.canBeConfirmed(),
  };
}

export function getSuggestedActions(order: Order | null): string[] {
  if (!order) {
    return ['Ver recomendaciones', 'Buscar una bebida', 'Ver menú completo'];
  }
  if (order.status.isPending()) {
    return ['Agregar otra bebida', 'Confirmar mi orden', 'Cancelar orden'];
  }
  if (order.status.isConfirmed()) {
    return ['Pagar ahora', 'Cancelar orden'];
  }
  if (order.status.isCompleted() || order.status.toString() === 'cancelled') {
    return ['Nueva orden'];
  }
  return [];
}
