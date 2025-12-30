import { Drink } from '@domain/entities';
import { Money } from '@domain/value-objects';

export interface DrinkSearchResultDto {
  /** The matched drink entity */
  drink: Drink;

  /**
   * Relevance score between 0 and 1.
   * Higher scores indicate better matches.
   * - 1.0: Perfect match
   * - 0.7+: Strong match
   * - 0.5+: Moderate match
   * - <0.5: Weak match
   */
  score: number;
}

/**
 * Filter criteria for drink searches.
 * All fields are optional - only specified fields will be applied.
 */
export interface DrinkSearchFiltersDto {
  /** Maximum price filter */
  maxPrice?: Money;

  /** Minimum price filter */
  minPrice?: Money;

  /** Only include drinks that support milk customization */
  supportsMilk?: boolean;

  /** Only include drinks that support size customization */
  supportsSize?: boolean;

  /** Only include drinks that support syrup customization */
  supportsSyrup?: boolean;
}
