export type DrinkSize = 'tall' | 'grande' | 'venti';
export type DrinkTemp = 'hot' | 'iced';

export interface DrinkCustomizationOptions {
  readonly milk: boolean;
  readonly syrup: boolean;
  readonly sweetener: boolean;
  readonly topping: boolean;
  readonly size: boolean;
}

export interface DrinkDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly basePrice: string;
  readonly temp: DrinkTemp;
  readonly imageUrl: string;
  readonly customizationOptions: DrinkCustomizationOptions;
}

export interface DrinkCardDto {
  readonly drinkId: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly temp: DrinkTemp;
  readonly imageUrl: string;
  readonly relevanceScore?: number;
  readonly customizations: {
    readonly sizes: DrinkSize[];
    readonly milks: string[];
    readonly syrups: string[];
  };
}

export interface DrinkResultDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly basePrice: string;
  readonly relevanceScore: number;
  readonly customizations: DrinkCustomizationOptions;
}

export interface SearchDrinksOutputDto {
  readonly results: DrinkResultDto[];
  readonly query: string;
  readonly totalFound: number;
}
