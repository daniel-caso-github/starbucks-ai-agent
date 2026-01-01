import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

/**
 * Definiciones de herramientas para el Barista AI de Starbucks.
 *
 * Estas herramientas permiten a Gemini realizar acciones estructuradas como
 * crear órdenes, modificar items y buscar bebidas.
 *
 * Note: We avoid using 'enum' in schemas as the Gemini SDK requires additional
 * 'format: "enum"' property that causes TypeScript issues. Instead, we document
 * valid values in the description field.
 */

export const CREATE_ORDER_TOOL: FunctionDeclaration = {
  name: 'create_order',
  description: `Agregar una bebida a la orden del cliente. Usa esto cuando el cliente quiere ordenar una bebida específica.
    Siempre confirma que el nombre de la bebida coincida con una del menú disponible.
    Si el cliente no especifica tamaño, usa "grande" por defecto.
    Si no se especifica cantidad, usa 1 por defecto.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      drinkName: {
        type: SchemaType.STRING,
        description:
          'El nombre exacto de la bebida del menú (ej: "Caffè Latte", "Caramel Macchiato")',
      },
      size: {
        type: SchemaType.STRING,
        description:
          'El tamaño de la bebida: "tall", "grande", o "venti". Por defecto es "grande" si no se especifica.',
      },
      quantity: {
        type: SchemaType.NUMBER,
        description: 'Cantidad de esta bebida a ordenar. Por defecto es 1.',
      },
      customizations: {
        type: SchemaType.OBJECT,
        description: 'Personalizaciones opcionales para la bebida',
        properties: {
          milk: {
            type: SchemaType.STRING,
            description:
              'Tipo de leche (ej: "avena", "almendra", "soya", "entera", "descremada", "coco")',
          },
          syrup: {
            type: SchemaType.STRING,
            description: 'Sabor de jarabe (ej: "vainilla", "caramelo", "avellana", "mocha")',
          },
          extraShots: {
            type: SchemaType.NUMBER,
            description: 'Número de shots extra de espresso',
          },
          temperature: {
            type: SchemaType.STRING,
            description: 'Preferencia de temperatura: "hot", "iced", o "extra-hot"',
          },
          sweetness: {
            type: SchemaType.STRING,
            description: 'Nivel de dulzura: "no-sweetener", "light", "normal", o "extra"',
          },
          topping: {
            type: SchemaType.STRING,
            description: 'Topping (ej: "crema batida", "caramelo", "canela")',
          },
        },
      },
    },
    required: ['drinkName'],
  },
};

export const MODIFY_ORDER_TOOL: FunctionDeclaration = {
  name: 'modify_order',
  description: `Modificar un item existente en la orden del cliente. Usa esto cuando el cliente quiere cambiar
    cantidad, tamaño o personalizaciones de un item que ya está en su orden.
    Puedes identificar el item por drinkName o por itemIndex (posición base 1 en la orden).
    Si se proporcionan ambos, itemIndex tiene precedencia.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      drinkName: {
        type: SchemaType.STRING,
        description: 'El nombre de la bebida a modificar (opcional si se proporciona itemIndex)',
      },
      itemIndex: {
        type: SchemaType.NUMBER,
        description:
          'La posición base 1 del item en la orden (ej: 1 para el primer item, 2 para el segundo). Usa cuando el cliente dice "el primero", "el item 2", etc.',
      },
      changes: {
        type: SchemaType.OBJECT,
        description: 'Los cambios a aplicar al item de la orden',
        properties: {
          newQuantity: {
            type: SchemaType.NUMBER,
            description: 'Nueva cantidad (usa 0 para eliminar el item)',
          },
          newSize: {
            type: SchemaType.STRING,
            description: 'Nuevo tamaño para la bebida: "tall", "grande", o "venti"',
          },
          addCustomizations: {
            type: SchemaType.OBJECT,
            description: 'Personalizaciones a agregar',
            properties: {
              milk: { type: SchemaType.STRING, description: 'Tipo de leche a agregar' },
              syrup: { type: SchemaType.STRING, description: 'Sabor de jarabe a agregar' },
              sweetener: { type: SchemaType.STRING, description: 'Endulzante a agregar' },
              topping: { type: SchemaType.STRING, description: 'Topping a agregar' },
            },
          },
          removeCustomizations: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              'Tipos de personalizaciones a eliminar: "milk", "syrup", "sweetener", o "topping"',
          },
        },
      },
    },
    required: ['changes'],
  },
};

export const REMOVE_FROM_ORDER_TOOL: FunctionDeclaration = {
  name: 'remove_from_order',
  description: `Eliminar un item completamente de la orden del cliente.
    Puedes identificar el item por drinkName o por itemIndex (posición base 1 en la orden).
    Si se proporcionan ambos, itemIndex tiene precedencia.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      drinkName: {
        type: SchemaType.STRING,
        description: 'El nombre de la bebida a eliminar (opcional si se proporciona itemIndex)',
      },
      itemIndex: {
        type: SchemaType.NUMBER,
        description:
          'La posición base 1 del item a eliminar (ej: 1 para el primer item, 2 para el segundo)',
      },
    },
  },
};

export const SEARCH_DRINKS_TOOL: FunctionDeclaration = {
  name: 'search_drinks',
  description: `Buscar bebidas cuando el cliente pregunta sobre el menú, quiere recomendaciones,
    o describe lo que está buscando. Usa esto para encontrar bebidas que coincidan con sus preferencias.
    Ejemplos: "algo frío", "bebida de chocolate", "opciones con poca cafeína"`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: 'Descripción en lenguaje natural de lo que el cliente está buscando',
      },
      filters: {
        type: SchemaType.OBJECT,
        description: 'Filtros opcionales para refinar la búsqueda',
        properties: {
          maxPrice: {
            type: SchemaType.NUMBER,
            description: 'Precio máximo en dólares',
          },
          hasCaffeine: {
            type: SchemaType.BOOLEAN,
            description: 'Si la bebida debe tener cafeína',
          },
          isIced: {
            type: SchemaType.BOOLEAN,
            description: 'Si buscar bebidas frías',
          },
        },
      },
    },
    required: ['query'],
  },
};

export const CONFIRM_ORDER_TOOL: FunctionDeclaration = {
  name: 'confirm_order',
  description: `Confirmar y finalizar la orden del cliente. Usa esto cuando el cliente indica
    que terminó de ordenar y quiere completar su compra. Siempre resume la orden antes de confirmar.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      confirmationMessage: {
        type: SchemaType.STRING,
        description: 'Un mensaje amigable confirmando los detalles de la orden',
      },
    },
    required: ['confirmationMessage'],
  },
};

export const CANCEL_ORDER_TOOL: FunctionDeclaration = {
  name: 'cancel_order',
  description: `Cancelar toda la orden actual. Usa esto cuando el cliente explícitamente quiere
    cancelar o empezar de nuevo. Siempre confirma antes de cancelar.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      reason: {
        type: SchemaType.STRING,
        description: 'Razón breve de la cancelación',
      },
    },
  },
};

export const GET_ORDER_SUMMARY_TOOL: FunctionDeclaration = {
  name: 'get_order_summary',
  description: `Obtener un resumen de la orden actual. Usa esto cuando el cliente pregunta
    "¿qué tengo en mi orden?", "¿puedes repetir eso?", o preguntas similares.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

export const GET_FULL_MENU_TOOL: FunctionDeclaration = {
  name: 'get_full_menu',
  description: `Obtener el menú completo de bebidas. Usa esto cuando el cliente pide ver el menú,
    la lista de bebidas, todas las opciones, o quiere saber qué bebidas hay disponibles.
    Ejemplos: "quiero ver el menú", "qué bebidas tienen", "muéstrame las opciones", "lista de bebidas"`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

export const GET_DRINK_DETAILS_TOOL: FunctionDeclaration = {
  name: 'get_drink_details',
  description: `Obtener detalles de una bebida específica. Usa esto cuando el cliente pregunta
    sobre los detalles, ingredientes, descripción o información de una bebida en particular.
    Ejemplos: "cuéntame más del Latte", "qué tiene el Mocha", "detalles del Cappuccino"`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      drinkName: {
        type: SchemaType.STRING,
        description: 'El nombre de la bebida de la cual se quieren obtener detalles',
      },
    },
    required: ['drinkName'],
  },
};

export const PROCESS_PAYMENT_TOOL: FunctionDeclaration = {
  name: 'process_payment',
  description: `Procesar el pago y completar la orden. Usa esto cuando el cliente dice
    "proceder al pago", "quiero pagar", "listo para pagar", o frases similares.
    Solo usa esto cuando la orden ya esté confirmada.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      paymentMessage: {
        type: SchemaType.STRING,
        description: 'Un mensaje amigable agradeciendo la compra',
      },
    },
    required: ['paymentMessage'],
  },
};

/**
 * Todas las herramientas disponibles para el barista AI.
 */
export const BARISTA_TOOLS: FunctionDeclaration[] = [
  CREATE_ORDER_TOOL,
  MODIFY_ORDER_TOOL,
  REMOVE_FROM_ORDER_TOOL,
  SEARCH_DRINKS_TOOL,
  CONFIRM_ORDER_TOOL,
  CANCEL_ORDER_TOOL,
  GET_ORDER_SUMMARY_TOOL,
  GET_FULL_MENU_TOOL,
  GET_DRINK_DETAILS_TOOL,
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

export interface GetDrinkDetailsInput {
  drinkName: string;
}

export type ToolInput =
  | CreateOrderInput
  | ModifyOrderInput
  | RemoveFromOrderInput
  | SearchDrinksInput
  | ConfirmOrderInput
  | CancelOrderInput
  | ProcessPaymentInput
  | GetDrinkDetailsInput
  | Record<string, never>; // Para get_order_summary y get_full_menu que no tienen inputs
