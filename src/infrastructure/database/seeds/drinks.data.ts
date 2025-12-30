/**
 * Starbucks drinks menu data for seeding the database.
 * Each drink includes realistic descriptions for semantic search.
 */

export interface DrinkSeedData {
  name: string;
  description: string;
  basePriceCents: number;
  customizations: {
    milk: boolean;
    syrup: boolean;
    sweetener: boolean;
    topping: boolean;
    size: boolean;
  };
}

export const DRINKS_SEED_DATA: DrinkSeedData[] = [
  // ============ Espresso Drinks ============
  {
    name: 'Caffè Latte',
    description:
      'Our dark, rich espresso balanced with steamed milk and a light layer of foam. A perfect milk-forward coffee drink that is smooth and subtly sweet.',
    basePriceCents: 475,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Cappuccino',
    description:
      'Dark, rich espresso lies in wait under a smoothed and stretched layer of thick foam. A classic Italian coffee drink with bold espresso flavor and creamy texture.',
    basePriceCents: 475,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Caramel Macchiato',
    description:
      'Freshly steamed milk with vanilla-flavored syrup marked with espresso and topped with a caramel drizzle. Sweet, creamy, and indulgent with a beautiful layered presentation.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Flat White',
    description:
      'Smooth ristretto shots of espresso get the perfect amount of steamed whole milk to create a not-too-strong, not-too-creamy, just-right flavor. Velvety and balanced.',
    basePriceCents: 495,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Americano',
    description:
      'Espresso shots topped with hot water to produce a light layer of crema. A bold and robust coffee drink with a clean finish. Perfect for those who prefer a stronger coffee taste.',
    basePriceCents: 375,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Espresso',
    description:
      'A single shot of our signature rich, caramelly espresso. Pure, intense coffee flavor in its most concentrated form. The foundation of all our espresso drinks.',
    basePriceCents: 295,
    customizations: {
      milk: false,
      syrup: true,
      sweetener: true,
      topping: false,
      size: false,
    },
  },
  {
    name: 'Espresso Macchiato',
    description:
      'Our rich espresso marked with a dollop of steamed milk and foam. A traditional Italian preparation that highlights the intensity of espresso with just a touch of cream.',
    basePriceCents: 315,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: false,
    },
  },

  // ============ Mocha & Chocolate Drinks ============
  {
    name: 'Caffè Mocha',
    description:
      'Our rich, full-bodied espresso combined with bittersweet mocha sauce and steamed milk, then topped with sweetened whipped cream. A delicious chocolate and coffee combination.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'White Chocolate Mocha',
    description:
      'Our signature espresso meets white chocolate sauce and steamed milk, then topped with sweetened whipped cream. Sweet, creamy, and indulgent with vanilla notes.',
    basePriceCents: 545,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Hot Chocolate',
    description:
      'Steamed milk with vanilla and mocha-flavored syrups, topped with sweetened whipped cream and a chocolate drizzle. A comforting, caffeine-free treat for chocolate lovers.',
    basePriceCents: 425,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },

  // ============ Iced Coffee & Cold Brew ============
  {
    name: 'Iced Coffee',
    description:
      'Freshly brewed coffee, sweetened and served over ice. A refreshing and energizing cold coffee drink perfect for warm days. Light and crisp with a smooth finish.',
    basePriceCents: 395,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Cold Brew',
    description:
      'Handcrafted in small batches daily, slow-steeped in cool water for 20 hours, without touching heat. Super smooth with a naturally sweet flavor and lower acidity.',
    basePriceCents: 445,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Nitro Cold Brew',
    description:
      'Our velvety smooth Cold Brew infused with nitrogen as it pours from the tap. Creamy, sweet, and cascading with beautiful bubbles. Served unsweetened and without ice.',
    basePriceCents: 495,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: false,
    },
  },
  {
    name: 'Vanilla Sweet Cream Cold Brew',
    description:
      'Our slow-steeped Cold Brew topped with a luscious vanilla sweet cream that cascades throughout the cup. Sweet, creamy, and refreshingly smooth.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Salted Caramel Cream Cold Brew',
    description:
      'Our Cold Brew topped with a salted caramel cream cold foam. A perfect balance of sweet and salty with rich caramel flavor and smooth cold brew coffee.',
    basePriceCents: 545,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },

  // ============ Iced Espresso Drinks ============
  {
    name: 'Iced Caffè Latte',
    description:
      'Our dark, rich espresso is combined with cold milk and served over ice. A smooth and refreshing coffee drink that is perfect for any time of day.',
    basePriceCents: 475,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced Caramel Macchiato',
    description:
      'We combine our rich, full-bodied espresso with vanilla-flavored syrup, milk and ice, then top it off with a caramel drizzle. Sweet, refreshing, and beautifully layered.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced Americano',
    description:
      'Espresso shots topped with cold water to produce a light layer of crema, then served over ice. Bold, refreshing, and perfect for espresso lovers who want a cold drink.',
    basePriceCents: 375,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Iced Mocha',
    description:
      'Our rich espresso combined with bittersweet mocha sauce, milk and ice, then topped with sweetened whipped cream. A chocolatey, refreshing coffee treat.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced White Chocolate Mocha',
    description:
      'Our signature espresso meets white chocolate sauce, milk and ice, then topped with sweetened whipped cream. Sweet, creamy, and perfectly refreshing.',
    basePriceCents: 545,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },

  // ============ Frappuccinos ============
  {
    name: 'Caramel Frappuccino',
    description:
      'Caramel syrup meets coffee, milk and ice for a delicious blend of flavors, then topped with whipped cream and caramel drizzle. Sweet, icy, and indulgent.',
    basePriceCents: 575,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Mocha Frappuccino',
    description:
      'Coffee is combined with a rich mocha sauce, milk and ice, then topped with whipped cream. A decadent frozen chocolate coffee drink that satisfies any sweet tooth.',
    basePriceCents: 575,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Java Chip Frappuccino',
    description:
      'We blend mocha sauce and Frappuccino chips with coffee, milk and ice, then top it off with whipped cream and a mocha drizzle. Rich, chocolatey, with crunchy chips.',
    basePriceCents: 595,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Vanilla Bean Frappuccino',
    description:
      'Vanilla bean, milk and ice blended together and topped with whipped cream. A creamy, sweet, caffeine-free frozen treat with real vanilla bean specks.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Strawberry Frappuccino',
    description:
      'Summer in a sip! Real strawberry puree blended with milk and ice for a refreshing, fruity frozen drink. Caffeine-free and topped with whipped cream.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },

  // ============ Refreshers ============
  {
    name: 'Strawberry Açaí Refresher',
    description:
      'Sweet strawberry flavors accented by passion fruit and açaí notes, combined with real strawberry pieces. Light caffeine from green coffee extract. Fruity and refreshing.',
    basePriceCents: 475,
    customizations: {
      milk: false,
      syrup: false,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Mango Dragonfruit Refresher',
    description:
      'Tropical mango and dragonfruit flavors with real dragonfruit pieces. Light caffeine from green coffee extract. A vibrant pink drink that is sweet and exotic.',
    basePriceCents: 475,
    customizations: {
      milk: false,
      syrup: false,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Pink Drink',
    description:
      'Our Strawberry Açaí Refresher with creamy coconut milk. A fruity and creamy combination that is beautiful pink in color. Sweet, refreshing, and Instagram-worthy.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: false,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Dragon Drink',
    description:
      'Our Mango Dragonfruit Refresher with creamy coconut milk. Tropical flavors meet smooth coconut for a refreshing, dairy-free drink with beautiful purple-pink color.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: false,
      sweetener: true,
      topping: false,
      size: true,
    },
  },

  // ============ Teas ============
  {
    name: 'Chai Tea Latte',
    description:
      'Black tea infused with cinnamon, clove and other warming spices is combined with steamed milk for a smooth, warming drink. Spicy, sweet, and comforting.',
    basePriceCents: 475,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced Chai Tea Latte',
    description:
      'Black tea infused with cinnamon, clove and other warming spices is combined with milk and ice for a refreshing, spiced drink. Cool and invigorating.',
    basePriceCents: 475,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Matcha Green Tea Latte',
    description:
      'Smooth and creamy matcha sweetened just right and served with steamed milk. Earthy, slightly sweet, with natural caffeine and L-theanine for calm energy.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced Matcha Green Tea Latte',
    description:
      'Smooth and creamy matcha sweetened just right and served with milk over ice. A refreshing, earthy green tea drink with vibrant color.',
    basePriceCents: 525,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'London Fog Tea Latte',
    description:
      'Bright, citrusy Earl Grey tea with lavender, vanilla syrup and steamed milk. An elegant, aromatic drink that is smooth and lightly sweet.',
    basePriceCents: 475,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced Black Tea',
    description:
      'Premium black tea shaken with ice for a refreshing, straightforward tea experience. Bold, slightly tannic, and naturally energizing.',
    basePriceCents: 325,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Iced Green Tea',
    description:
      'Premium green tea shaken with ice. Light, refreshing, and slightly grassy with natural antioxidants. A clean and healthy choice.',
    basePriceCents: 325,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },
  {
    name: 'Iced Passion Tango Tea',
    description:
      'A blend of hibiscus, lemongrass and apple hand-shaken with ice. Bright, herbal, and caffeine-free with a beautiful deep pink color.',
    basePriceCents: 325,
    customizations: {
      milk: false,
      syrup: true,
      sweetener: true,
      topping: false,
      size: true,
    },
  },

  // ============ Other ============
  {
    name: 'Pumpkin Spice Latte',
    description:
      'Our signature espresso and steamed milk with the celebrated flavor of pumpkin pie spices, topped with whipped cream and pumpkin spice topping. A fall favorite.',
    basePriceCents: 575,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Iced Pumpkin Spice Latte',
    description:
      'Our signature espresso combined with pumpkin pie spices, milk and ice, topped with whipped cream and pumpkin spice topping. Fall flavors on ice.',
    basePriceCents: 575,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
  {
    name: 'Pumpkin Cream Cold Brew',
    description:
      'Our Cold Brew topped with pumpkin cream cold foam and a dusting of pumpkin spice. A smooth, creamy way to enjoy fall flavors with cold brew coffee.',
    basePriceCents: 575,
    customizations: {
      milk: true,
      syrup: true,
      sweetener: true,
      topping: true,
      size: true,
    },
  },
];
