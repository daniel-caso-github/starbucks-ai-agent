import { CustomizationOptions, DrinkId, Money } from '../value-objects';

/**
 * Entity representing a drink in the Starbucks menu.
 * Has unique identity and contains business rules about customizations.
 */
export class Drink {
  private constructor(
    public readonly id: DrinkId,
    public readonly name: string,
    public readonly description: string,
    public readonly basePrice: Money,
    public readonly customizationOptions: CustomizationOptions,
  ) {
    this.validate();
  }

  // Factory method: create a new drink
  static create(props: {
    id?: DrinkId;
    name: string;
    description: string;
    basePrice: Money;
    customizationOptions?: CustomizationOptions;
  }): Drink {
    return new Drink(
      props.id ?? DrinkId.generate(),
      props.name,
      props.description,
      props.basePrice,
      props.customizationOptions ?? CustomizationOptions.none(),
    );
  }

  // Factory method: reconstitute from persistence (database)
  static reconstitute(props: {
    id: DrinkId;
    name: string;
    description: string;
    basePrice: Money;
    customizationOptions: CustomizationOptions;
  }): Drink {
    return new Drink(
      props.id,
      props.name,
      props.description,
      props.basePrice,
      props.customizationOptions,
    );
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Drink name cannot be empty');
    }
    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Drink description cannot be empty');
    }
  }

  // Business logic: check if customization is supported
  supportsCustomization(type: 'milk' | 'syrup' | 'sweetener' | 'topping' | 'size'): boolean {
    return this.customizationOptions.supports(type);
  }

  // Business logic: check if drink can have different sizes
  hasMultipleSizes(): boolean {
    return this.customizationOptions.size;
  }

  // Entity equality: compare by identity, not attributes
  equals(other: Drink): boolean {
    return this.id.equals(other.id);
  }

  // Generate summary for AI context (used in RAG)
  toSummary(): string {
    const customizations: string[] = [];

    if (this.customizationOptions.milk) customizations.push('milk options');
    if (this.customizationOptions.syrup) customizations.push('syrup flavors');
    if (this.customizationOptions.sweetener) customizations.push('sweeteners');
    if (this.customizationOptions.topping) customizations.push('toppings');
    if (this.customizationOptions.size) customizations.push('multiple sizes');

    const customizationText =
      customizations.length > 0
        ? `Available customizations: ${customizations.join(', ')}.`
        : 'No customizations available.';

    return `${this.name}: ${
      this.description
    } Base price: ${this.basePrice.format()}. ${customizationText}`;
  }
}
