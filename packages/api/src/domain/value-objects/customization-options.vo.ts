/**
 * Value Object representing which customizations a drink supports.
 * Immutable configuration object.
 */
export class CustomizationOptions {
  constructor(
    public readonly milk: boolean = false,
    public readonly syrup: boolean = false,
    public readonly sweetener: boolean = false,
    public readonly topping: boolean = false,
    public readonly size: boolean = false,
  ) {}

  // Factory method for drinks that support all customizations
  static all(): CustomizationOptions {
    return new CustomizationOptions(true, true, true, true, true);
  }

  // Factory method for drinks with no customizations
  static none(): CustomizationOptions {
    return new CustomizationOptions(false, false, false, false, false);
  }

  // Check if a specific customization is supported
  supports(type: 'milk' | 'syrup' | 'sweetener' | 'topping' | 'size'): boolean {
    return this[type];
  }
}
