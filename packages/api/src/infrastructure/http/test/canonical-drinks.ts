import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';

const all = CustomizationOptions.all();

export const CANONICAL_DRINKS = {
  caffeLatte: Drink.create({
    id: DrinkId.fromString('drink-caffe-latte'),
    name: 'Caffè Latte',
    description: 'Espresso rico con leche al vapor y una fina capa de espuma.',
    basePrice: Money.fromCents(475, 'USD'),
    customizationOptions: all,
    isHot: true,
  }),
  caramelMacchiato: Drink.create({
    id: DrinkId.fromString('drink-caramel-macchiato'),
    name: 'Caramel Macchiato',
    description: 'Espresso con leche al vapor y salsa de caramelo.',
    basePrice: Money.fromCents(545, 'USD'),
    customizationOptions: all,
    isHot: true,
  }),
  coldBrew: Drink.create({
    id: DrinkId.fromString('drink-cold-brew'),
    name: 'Cold Brew',
    description: 'Café preparado en frío durante 20 horas. Suave y refrescante.',
    basePrice: Money.fromCents(425, 'USD'),
    customizationOptions: all,
    isHot: false,
  }),
  icedCoffee: Drink.create({
    id: DrinkId.fromString('drink-iced-coffee'),
    name: 'Iced Coffee',
    description: 'Café negro servido sobre hielo. Refrescante y ligero.',
    basePrice: Money.fromCents(395, 'USD'),
    customizationOptions: all,
    isHot: false,
  }),
  caramelFrappuccino: Drink.create({
    id: DrinkId.fromString('drink-caramel-frappuccino'),
    name: 'Caramel Frappuccino',
    description: 'Bebida cremosa con café, hielo y salsa de caramelo.',
    basePrice: Money.fromCents(595, 'USD'),
    customizationOptions: all,
    isHot: false,
  }),
  vanillaLatte: Drink.create({
    id: DrinkId.fromString('drink-vanilla-latte'),
    name: 'Vanilla Latte',
    description: 'Espresso con leche al vapor y sirope de vainilla.',
    basePrice: Money.fromCents(525, 'USD'),
    customizationOptions: all,
    isHot: true,
  }),
} as const;

export const ALL_DRINKS: Drink[] = Object.values(CANONICAL_DRINKS);
