import { InvalidValueException } from '../exceptions';

/**
 * Value Object representing drink size.
 * Contains predefined sizes with their capacities.
 */
export class DrinkSize {
  private static readonly SIZES: Record<string, number> = {
    tall: 12,
    grande: 16,
    venti: 20,
  };

  private constructor(public readonly value: string, public readonly capacityOz: number) {}

  // Factory methods for each size
  static tall(): DrinkSize {
    return new DrinkSize('tall', DrinkSize.SIZES.tall);
  }

  static grande(): DrinkSize {
    return new DrinkSize('grande', DrinkSize.SIZES.grande);
  }

  static venti(): DrinkSize {
    return new DrinkSize('venti', DrinkSize.SIZES.venti);
  }

  // Factory method: create from string (e.g., from database)
  static fromString(size: string): DrinkSize {
    const normalized = size.toLowerCase().trim();
    const capacity = DrinkSize.SIZES[normalized];

    if (capacity === undefined) {
      const validSizes = Object.keys(DrinkSize.SIZES).join(', ');
      throw new InvalidValueException(
        'DrinkSize',
        `"${size}" is not valid. Valid sizes: ${validSizes}`,
      );
    }

    return new DrinkSize(normalized, capacity);
  }

  // Get capacity in ounces
  getCapacityOz(): number {
    return this.capacityOz;
  }

  // Compare sizes
  isLargerThan(other: DrinkSize): boolean {
    return this.capacityOz > other.capacityOz;
  }

  // Value Object equality
  equals(other: DrinkSize): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
