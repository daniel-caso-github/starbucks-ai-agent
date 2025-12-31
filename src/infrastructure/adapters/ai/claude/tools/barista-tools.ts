import { Tool } from '@anthropic-ai/sdk/resources/messages';

/**
 * Definiciones de herramientas para el Barista AI de Starbucks.
 *
 * Estas herramientas permiten a Claude realizar acciones estructuradas como
 * crear órdenes, modificar items y buscar bebidas.
 * Usar herramientas es más confiable que pedir a Claude que devuelva JSON
 * porque el SDK valida el esquema automáticamente.
 */

export const CREATE_ORDER_TOOL: Tool = {
  name: 'create_order',
  description: `Agregar una bebida a la orden del cliente. Usa esto cuando el cliente quiere ordenar una bebida específica.
    Siempre confirma que el nombre de la bebida coincida con una del menú disponible.
    Si el cliente no especifica tamaño, usa "grande" por defecto.
    Si no se especifica cantidad, usa 1 por defecto.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      drinkName: {
        type: 'string',
        description:
          'El nombre exacto de la bebida del menú (ej: "Caffè Latte", "Caramel Macchiato")',
      },
      size: {
        type: 'string',
        enum: ['tall', 'grande', 'venti'],
        description: 'El tamaño de la bebida. Por defecto es "grande" si no se especifica.',
      },
      quantity: {
        type: 'number',
        description: 'Cantidad de esta bebida a ordenar. Por defecto es 1.',
        minimum: 1,
        maximum: 10,
      },
      customizations: {
        type: 'object',
        description: 'Personalizaciones opcionales para la bebida',
        properties: {
          milk: {
            type: 'string',
            description: 'Tipo de leche (ej: "avena", "almendra", "soya", "entera", "descremada", "coco")',
          },
          syrup: {
            type: 'string',
            description: 'Sabor de jarabe (ej: "vainilla", "caramelo", "avellana", "mocha")',
          },
          extraShots: {
            type: 'number',
            description: 'Número de shots extra de espresso',
          },
          temperature: {
            type: 'string',
            enum: ['hot', 'iced', 'extra-hot'],
            description: 'Preferencia de temperatura (caliente, frío, extra caliente)',
          },
          sweetness: {
            type: 'string',
            enum: ['no-sweetener', 'light', 'normal', 'extra'],
            description: 'Nivel de dulzura',
          },
          topping: {
            type: 'string',
            description: 'Topping (ej: "crema batida", "caramelo", "canela")',
          },
        },
      },
    },
    required: ['drinkName'],
  },
};

export const MODIFY_ORDER_TOOL: Tool = {
  name: 'modify_order',
  description: `Modificar un item existente en la orden del cliente. Usa esto cuando el cliente quiere cambiar
    cantidad, tamaño o personalizaciones de un item que ya está en su orden.
    Puedes identificar el item por drinkName o por itemIndex (posición base 1 en la orden).
    Si se proporcionan ambos, itemIndex tiene precedencia.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      drinkName: {
        type: 'string',
        description: 'El nombre de la bebida a modificar (opcional si se proporciona itemIndex)',
      },
      itemIndex: {
        type: 'number',
        description:
          'La posición base 1 del item en la orden (ej: 1 para el primer item, 2 para el segundo). Usa cuando el cliente dice "el primero", "el item 2", etc.',
        minimum: 1,
      },
      changes: {
        type: 'object',
        description: 'Los cambios a aplicar al item de la orden',
        properties: {
          newQuantity: {
            type: 'number',
            description: 'Nueva cantidad (usa 0 para eliminar el item)',
            minimum: 0,
            maximum: 10,
          },
          newSize: {
            type: 'string',
            enum: ['tall', 'grande', 'venti'],
            description: 'Nuevo tamaño para la bebida',
          },
          addCustomizations: {
            type: 'object',
            description: 'Personalizaciones a agregar',
            properties: {
              milk: { type: 'string', description: 'Tipo de leche a agregar' },
              syrup: { type: 'string', description: 'Sabor de jarabe a agregar' },
              sweetener: { type: 'string', description: 'Endulzante a agregar' },
              topping: { type: 'string', description: 'Topping a agregar' },
            },
          },
          removeCustomizations: {
            type: 'array',
            items: { type: 'string', enum: ['milk', 'syrup', 'sweetener', 'topping'] },
            description: 'Tipos de personalizaciones a eliminar',
          },
        },
      },
    },
    required: ['changes'],
  },
};

export const REMOVE_FROM_ORDER_TOOL: Tool = {
  name: 'remove_from_order',
  description: `Eliminar un item completamente de la orden del cliente.
    Puedes identificar el item por drinkName o por itemIndex (posición base 1 en la orden).
    Si se proporcionan ambos, itemIndex tiene precedencia.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      drinkName: {
        type: 'string',
        description: 'El nombre de la bebida a eliminar (opcional si se proporciona itemIndex)',
      },
      itemIndex: {
        type: 'number',
        description:
          'La posición base 1 del item a eliminar (ej: 1 para el primer item, 2 para el segundo)',
        minimum: 1,
      },
    },
  },
};

export const SEARCH_DRINKS_TOOL: Tool = {
  name: 'search_drinks',
  description: `Buscar bebidas cuando el cliente pregunta sobre el menú, quiere recomendaciones,
    o describe lo que está buscando. Usa esto para encontrar bebidas que coincidan con sus preferencias.
    Ejemplos: "algo frío", "bebida de chocolate", "opciones con poca cafeína"`,
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Descripción en lenguaje natural de lo que el cliente está buscando',
      },
      filters: {
        type: 'object',
        description: 'Filtros opcionales para refinar la búsqueda',
        properties: {
          maxPrice: {
            type: 'number',
            description: 'Precio máximo en dólares',
          },
          hasCaffeine: {
            type: 'boolean',
            description: 'Si la bebida debe tener cafeína',
          },
          isIced: {
            type: 'boolean',
            description: 'Si buscar bebidas frías',
          },
        },
      },
    },
    required: ['query'],
  },
};

export const CONFIRM_ORDER_TOOL: Tool = {
  name: 'confirm_order',
  description: `Confirmar y finalizar la orden del cliente. Usa esto cuando el cliente indica
    que terminó de ordenar y quiere completar su compra. Siempre resume la orden antes de confirmar.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      confirmationMessage: {
        type: 'string',
        description: 'Un mensaje amigable confirmando los detalles de la orden',
      },
    },
    required: ['confirmationMessage'],
  },
};

export const CANCEL_ORDER_TOOL: Tool = {
  name: 'cancel_order',
  description: `Cancelar toda la orden actual. Usa esto cuando el cliente explícitamente quiere
    cancelar o empezar de nuevo. Siempre confirma antes de cancelar.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      reason: {
        type: 'string',
        description: 'Razón breve de la cancelación',
      },
    },
  },
};

export const GET_ORDER_SUMMARY_TOOL: Tool = {
  name: 'get_order_summary',
  description: `Obtener un resumen de la orden actual. Usa esto cuando el cliente pregunta
    "¿qué tengo en mi orden?", "¿puedes repetir eso?", o preguntas similares.`,
  input_schema: {
    type: 'object' as const,
    properties: {},
  },
};

export const PROCESS_PAYMENT_TOOL: Tool = {
  name: 'process_payment',
  description: `Procesar el pago y completar la orden. Usa esto cuando el cliente dice
    "proceder al pago", "quiero pagar", "listo para pagar", o frases similares.
    Solo usa esto cuando la orden ya esté confirmada.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      paymentMessage: {
        type: 'string',
        description: 'Un mensaje amigable agradeciendo la compra',
      },
    },
    required: ['paymentMessage'],
  },
};

/**
 * Todas las herramientas disponibles para el barista AI.
 */
export const BARISTA_TOOLS: Tool[] = [
  CREATE_ORDER_TOOL,
  MODIFY_ORDER_TOOL,
  REMOVE_FROM_ORDER_TOOL,
  SEARCH_DRINKS_TOOL,
  CONFIRM_ORDER_TOOL,
  CANCEL_ORDER_TOOL,
  GET_ORDER_SUMMARY_TOOL,
  PROCESS_PAYMENT_TOOL,
];

/**
 * Definiciones de tipos para inputs de herramientas (para type safety en handlers)
 */
export interface CreateOrderInput {
  drinkName: string;
  size?: 'tall' | 'grande' | 'venti';
  quantity?: number;
  customizations?: {
    milk?: string;
    syrup?: string;
    extraShots?: number;
    temperature?: 'hot' | 'iced' | 'extra-hot';
    sweetness?: 'no-sweetener' | 'light' | 'normal' | 'extra';
    topping?: string;
  };
}

export interface ModifyOrderInput {
  drinkName?: string;
  itemIndex?: number;
  changes: {
    newQuantity?: number;
    newSize?: 'tall' | 'grande' | 'venti';
    addCustomizations?: {
      milk?: string;
      syrup?: string;
      sweetener?: string;
      topping?: string;
    };
    removeCustomizations?: ('milk' | 'syrup' | 'sweetener' | 'topping')[];
  };
}

export interface RemoveFromOrderInput {
  drinkName?: string;
  itemIndex?: number;
}

export interface SearchDrinksInput {
  query: string;
  filters?: {
    maxPrice?: number;
    hasCaffeine?: boolean;
    isIced?: boolean;
  };
}

export interface ConfirmOrderInput {
  confirmationMessage: string;
}

export interface CancelOrderInput {
  reason?: string;
}

export interface ProcessPaymentInput {
  paymentMessage: string;
}

export type ToolInput =
  | CreateOrderInput
  | ModifyOrderInput
  | RemoveFromOrderInput
  | SearchDrinksInput
  | ConfirmOrderInput
  | CancelOrderInput
  | ProcessPaymentInput
  | Record<string, never>; // Para get_order_summary que no tiene inputs
