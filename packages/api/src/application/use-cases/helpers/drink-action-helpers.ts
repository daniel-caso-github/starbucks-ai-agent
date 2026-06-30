import { Logger } from '@nestjs/common';
import { Drink } from '@domain/entities';
import { Money } from '@domain/value-objects';
import { DrinkCardDto } from '@application/dtos';
import { SuggestedActionType } from '@application/dtos/conversation-ai.dto';
import { IDrinkRepositoryPort, IDrinkSearcherPort } from '@application/ports/outbound';

export function mapDrinkToCard(drink: Drink, relevanceScore?: number): DrinkCardDto {
  const sizes: ('tall' | 'grande' | 'venti')[] = drink.customizationOptions.size
    ? ['tall', 'grande', 'venti']
    : ['grande'];
  const milks = drink.customizationOptions.milk
    ? ['Avena', 'Almendra', 'Entera', '2%', 'Coco', 'Soya']
    : [];
  const syrups = drink.customizationOptions.syrup
    ? ['Vainilla', 'Caramelo', 'Avellana']
    : [];

  return {
    drinkId: drink.id.toString(),
    name: drink.name,
    description: drink.description,
    price: drink.basePrice.cents / 100,
    temp: drink.isHot ? 'hot' : 'iced',
    imageUrl: drink.imageUrl,
    ...(relevanceScore !== undefined ? { relevanceScore } : {}),
    customizations: { sizes, milks, syrups },
  };
}

export async function handleSpecialActions(
  _originalMessage: string,
  suggestedActions: SuggestedActionType[],
  drinkRepository: IDrinkRepositoryPort,
  drinkSearcher: IDrinkSearcherPort,
  logger: Logger,
): Promise<DrinkCardDto[]> {
  const menuAction = suggestedActions.find((a) => a.type === 'get_full_menu');
  if (menuAction) {
    try {
      const allDrinks = await drinkRepository.findAll();
      return allDrinks.map((d) => mapDrinkToCard(d));
    } catch (error) {
      logger.error(`Error fetching full menu: ${error}`);
      return [];
    }
  }

  const detailsAction = suggestedActions.find((a) => a.type === 'get_drink_details');
  if (detailsAction && detailsAction.payload?.drinkName) {
    try {
      const drinkName = detailsAction.payload.drinkName as string;
      let drink = await drinkRepository.findByName(drinkName);
      if (!drink) {
        const results = await drinkSearcher.findSimilar(drinkName, 1);
        if (results.length > 0) drink = results[0].drink;
      }
      return drink ? [mapDrinkToCard(drink)] : [];
    } catch (error) {
      logger.error(`Error fetching drink details: ${error}`);
      return [];
    }
  }

  const searchAction = suggestedActions.find((a) => a.type === 'search_drinks');
  if (searchAction && searchAction.payload?.query) {
    try {
      const rawFilters = searchAction.payload.filters as
        | { isIced?: boolean; maxPrice?: number }
        | undefined;
      const filters = rawFilters
        ? {
            isHot: rawFilters.isIced !== undefined ? !rawFilters.isIced : undefined,
            maxPrice: rawFilters.maxPrice
              ? Money.fromCents(rawFilters.maxPrice * 100, 'USD')
              : undefined,
          }
        : undefined;
      const results = await drinkSearcher.findSimilar(
        searchAction.payload.query as string,
        5,
        filters,
      );
      return results.map((r) => mapDrinkToCard(r.drink, r.score));
    } catch (error) {
      logger.error(`Error searching drinks: ${error}`);
      return [];
    }
  }

  return [];
}
