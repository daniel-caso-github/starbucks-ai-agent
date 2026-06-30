/**
 * Mapping of drink names to image URLs from the official Starbucks CDN.
 * Scraped from starbucks.com (hot-coffee, cold-coffee, frappuccino, teas, refreshers, hot-chocolate).
 * Falls back to a category-level image when a specific drink isn't found
 * (e.g. seasonal items out of menu).
 */

const CDN_BASE = 'https://cloudassets.starbucks.com/is/image/sbuxcorp';
const CDN_QS = 'impolicy=1by1_tight_288&wid=288&hei=288&qlt=85';

const img = (slug: string): string => `${CDN_BASE}/${slug}?${CDN_QS}`;

export const DRINK_IMAGES: Record<string, string> = {
  // Espresso
  'Caffè Latte': img('CaffeLatte'),
  Cappuccino: img('Cappuccino'),
  'Caramel Macchiato': img('SBX20211029_CaramelMacchiato'),
  'Flat White': img('SBX20230406_FlatWhite'),
  Americano: img('CaffeAmericano'),
  Espresso: img('SBX20190617_Espresso_Single'),
  'Espresso Macchiato': img('SBX20190617_EspressoMacchiato'),

  // Mocha & Chocolate
  'Caffè Mocha': img('SBX20220607_CaffeMocha'),
  'White Chocolate Mocha': img('WhiteChocolateMocha'),
  'Hot Chocolate': img('HotChocolate'),

  // Iced Coffee & Cold Brew
  'Iced Coffee': img('IcedCoffee'),
  'Cold Brew': img('ColdBrew'),
  'Nitro Cold Brew': img('NitroColdBrew'),
  'Vanilla Sweet Cream Cold Brew': img('VanillaSweetCreamColdBrew'),
  'Salted Caramel Cream Cold Brew': img('SBX20211029_SaltedCaramelCreamColdBrew'),

  // Iced Espresso
  'Iced Caffè Latte': img('IcedCaffeLatte'),
  'Iced Caramel Macchiato': img('IcedCaramelMacchiato'),
  'Iced Americano': img('IcedCaffeAmericano'),
  'Iced Mocha': img('IcedCaffeMocha%E2%80%8B'),
  'Iced White Chocolate Mocha': img('IcedWhiteChocolateMocha'),

  // Frappuccinos
  'Caramel Frappuccino': img('SBX20220323_CaramelFrapp'),
  'Mocha Frappuccino': img('MochaFrappuccino'),
  // Java Chip not on current public menu — reuse Mocha Cookie Crumble (mocha + chips)
  'Java Chip Frappuccino': img('SBX20211210_MochaCookieCrumbleFrapp'),
  'Vanilla Bean Frappuccino': img('VanillaBeanCremeFrappuccino'),
  'Strawberry Frappuccino': img('SBX20220323_StrawberryFrapp'),

  // Refreshers
  'Strawberry Açaí Refresher': img('StrawberryAcai'),
  'Mango Dragonfruit Refresher': img('MangoDragonfruitRefreshers'),
  'Pink Drink': img('PinkDrink'),
  'Dragon Drink': img('DragonDrink'),

  // Teas
  'Chai Tea Latte': img('SBX20220411_ChaiLatte'),
  'Iced Chai Tea Latte': img('IcedChaiTeaLatte'),
  'Matcha Green Tea Latte': img('SBX20211115_MatchaTeaLatte'),
  'Iced Matcha Green Tea Latte': img('IcedMatchaTeaLatte'),
  'London Fog Tea Latte': img('SBX20190624_LondonFogTeaLatte'),
  'Iced Black Tea': img('IcedBlackTea'),
  'Iced Green Tea': img('IcedGreenTea'),
  'Iced Passion Tango Tea': img('IcedPassionTangoTea'),

  // Seasonal (Pumpkin family)
  'Pumpkin Spice Latte': img('PumpkinSpiceLatte'),
  // Iced PSL slug not exposed on public CDN — reuse hot PSL image
  'Iced Pumpkin Spice Latte': img('PumpkinSpiceLatte'),
  'Pumpkin Cream Cold Brew': img('PumpkinCreamColdBrew'),
};

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  Espresso: img('CaffeLatte'),
  Mocha: img('SBX20220607_CaffeMocha'),
  ColdBrew: img('ColdBrew'),
  IcedEspresso: img('IcedCaffeLatte'),
  Frappuccino: img('MochaFrappuccino'),
  Refresher: img('StrawberryAcai'),
  Tea: img('SBX20220411_ChaiLatte'),
  Other: img('CaffeLatte'),
};

const inferCategoryKey = (name: string): keyof typeof CATEGORY_FALLBACK_IMAGES => {
  const n = name.toLowerCase();
  if (n.includes('frappuccino')) return 'Frappuccino';
  if (n.includes('refresher') || n.includes('pink drink') || n.includes('dragon drink')) {
    return 'Refresher';
  }
  if (n.includes('tea') || n.includes('chai') || n.includes('matcha')) return 'Tea';
  if (n.includes('cold brew') || n.includes('nitro')) return 'ColdBrew';
  if (n.startsWith('iced')) return 'IcedEspresso';
  if (n.includes('mocha') || n.includes('chocolate')) return 'Mocha';
  return 'Espresso';
};

/**
 * Resolves a drink name to its image URL.
 * Order: exact match -> category fallback -> generic fallback.
 */
export const getDrinkImageUrl = (name: string): string => {
  const exact = DRINK_IMAGES[name];
  if (exact) return exact;
  return CATEGORY_FALLBACK_IMAGES[inferCategoryKey(name)] ?? CATEGORY_FALLBACK_IMAGES.Other;
};
