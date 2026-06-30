import type { DrinkDto, SearchDrinksOutputDto } from '@starbucks/shared';
import { apiClient } from './client';

export async function getMenu(): Promise<{ total: number; drinks: DrinkDto[] }> {
  return apiClient.get('drinks').json<{ total: number; drinks: DrinkDto[] }>();
}

export async function searchDrinks(
  query: string,
  limit = 5,
): Promise<SearchDrinksOutputDto> {
  return apiClient
    .get('drinks/search', { searchParams: { query, limit } })
    .json<SearchDrinksOutputDto>();
}
