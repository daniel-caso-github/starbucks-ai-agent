import { Injectable } from '@nestjs/common';
import { Drink } from '@domain/entities';
import { DrinkId } from '@domain/value-objects';
import { IDrinkRepositoryPort } from '@application/ports/outbound';
import { IDrinkSearcherPort } from '@application/ports/outbound';
import { DrinkSearchFiltersDto, DrinkSearchResultDto } from '@application/dtos/drink-searcher.dto';
import { ALL_DRINKS, CANONICAL_DRINKS } from './canonical-drinks';

@Injectable()
export class InMemoryDrinkRepository implements IDrinkRepositoryPort {
  async save(_drink: Drink): Promise<void> {}
  async saveMany(_drinks: Drink[]): Promise<void> {}

  async findById(id: DrinkId): Promise<Drink | null> {
    return ALL_DRINKS.find((d) => d.id.toString() === id.toString()) ?? null;
  }

  async findByName(name: string): Promise<Drink | null> {
    const lower = name.toLowerCase();
    return ALL_DRINKS.find((d) => d.name.toLowerCase() === lower) ?? null;
  }

  async findAll(): Promise<Drink[]> {
    return [...ALL_DRINKS];
  }

  async delete(_id: DrinkId): Promise<boolean> {
    return false;
  }

  async count(): Promise<number> {
    return ALL_DRINKS.length;
  }
}

@Injectable()
export class InMemoryDrinkSearcher implements IDrinkSearcherPort {
  async findSimilar(
    query: string,
    limit = 5,
    filters?: DrinkSearchFiltersDto,
  ): Promise<DrinkSearchResultDto[]> {
    const q = query.toLowerCase();

    let results: DrinkSearchResultDto[];

    if (q.includes('caramelo') || q.includes('caramel') || q.includes('busca') || q.includes('buscar')) {
      results = [
        { drink: CANONICAL_DRINKS.caramelMacchiato, score: 0.96 },
        { drink: CANONICAL_DRINKS.caramelFrappuccino, score: 0.93 },
        { drink: CANONICAL_DRINKS.vanillaLatte, score: 0.81 },
      ];
    } else if (q.includes('frío') || q.includes('frio') || q.includes('helad') || q.includes('cold') || q.includes('iced')) {
      results = [
        { drink: CANONICAL_DRINKS.icedCoffee, score: 0.95 },
        { drink: CANONICAL_DRINKS.coldBrew, score: 0.93 },
        { drink: CANONICAL_DRINKS.caramelFrappuccino, score: 0.90 },
      ];
    } else {
      results = [
        { drink: CANONICAL_DRINKS.caffeLatte, score: 0.90 },
        { drink: CANONICAL_DRINKS.caramelMacchiato, score: 0.88 },
        { drink: CANONICAL_DRINKS.coldBrew, score: 0.85 },
      ];
    }

    if (filters?.isHot !== undefined) {
      results = results.filter((r) => r.drink.isHot === filters.isHot);
    }

    return results.slice(0, limit);
  }

  async findByName(name: string): Promise<Drink | null> {
    const lower = name.toLowerCase();
    return ALL_DRINKS.find((d) => d.name.toLowerCase() === lower) ?? null;
  }

  async findById(id: DrinkId): Promise<Drink | null> {
    return ALL_DRINKS.find((d) => d.id.toString() === id.toString()) ?? null;
  }

  async findAll(): Promise<Drink[]> {
    return [...ALL_DRINKS];
  }

  async index(_drink: Drink): Promise<void> {}
  async indexBatch(_drinks: Drink[]): Promise<void> {}
  async removeFromIndex(_id: DrinkId): Promise<boolean> {
    return false;
  }
  async clearIndex(): Promise<void> {}
}
