import { Inject, Injectable, Logger } from '@nestjs/common';
import { IDrinkRepositoryPort, IDrinkSearcherPort } from '@application/ports/outbound';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';
import { DRINKS_SEED_DATA, DrinkSeedData } from './drinks.data';
import { getDrinkImageUrl } from './drink-images';

/**
 * Service responsible for seeding the drinks database and search index.
 */
@Injectable()
export class DrinkSeederService {
  private readonly logger = new Logger(DrinkSeederService.name);

  constructor(
    @Inject('IDrinkRepository')
    private readonly drinkRepository: IDrinkRepositoryPort,
    @Inject('IDrinkSearcher')
    private readonly drinkSearcher: IDrinkSearcherPort,
  ) {}

  /**
   * Seeds the database with all drinks from the seed data.
   * Also indexes them in ChromaDB for semantic search.
   */
  async seed(): Promise<void> {
    this.logger.log('Starting drink seed process...');

    const drinks = this.createDrinksFromSeedData();

    // Save to MongoDB
    this.logger.log(`Saving ${drinks.length} drinks to database...`);
    await this.drinkRepository.saveMany(drinks);

    // Index in ChromaDB for semantic search
    this.logger.log(`Indexing ${drinks.length} drinks in ChromaDB...`);
    await this.drinkSearcher.indexBatch(drinks);

    this.logger.log(`✅ Successfully seeded ${drinks.length} drinks`);
  }

  /**
   * Clears all drinks from database and search index.
   */
  async clear(): Promise<void> {
    this.logger.log('Clearing existing drinks...');

    // Wipe the entire ChromaDB collection first (removes orphan docs too)
    await this.drinkSearcher.clearIndex();

    const existingDrinks = await this.drinkRepository.findAll();
    for (const drink of existingDrinks) {
      await this.drinkRepository.delete(drink.id);
    }

    this.logger.log(`✅ Cleared ${existingDrinks.length} drinks from DB and full index`);
  }

  /**
   * Reseeds the database (clear + seed).
   */
  async reseed(): Promise<void> {
    await this.clear();
    await this.seed();
  }

  /**
   * Gets statistics about the current drinks data.
   */
  async getStats(): Promise<{
    totalDrinks: number;
    categories: Record<string, number>;
  }> {
    const drinks = await this.drinkRepository.findAll();

    const categories: Record<string, number> = {};
    for (const drink of drinks) {
      const category = this.inferCategory(drink.name);
      categories[category] = (categories[category] || 0) + 1;
    }

    return {
      totalDrinks: drinks.length,
      categories,
    };
  }

  /**
   * Converts seed data to Drink entities.
   */
  private createDrinksFromSeedData(): Drink[] {
    return DRINKS_SEED_DATA.map((data) => this.seedDataToDrink(data));
  }

  /**
   * Converts a single seed data entry to a Drink entity.
   */
  private seedDataToDrink(data: DrinkSeedData): Drink {
    const slug = data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return Drink.create({
      id: DrinkId.fromString(`drk_${slug}`),
      name: data.name,
      description: data.description,
      basePrice: Money.fromCents(data.basePriceCents),
      customizationOptions: new CustomizationOptions(
        data.customizations.milk,
        data.customizations.syrup,
        data.customizations.sweetener,
        data.customizations.topping,
        data.customizations.size,
      ),
      isHot: data.isHot,
      imageUrl: getDrinkImageUrl(data.name),
    });
  }

  /**
   * Infers a category from the drink name for statistics.
   */
  private inferCategory(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('frappuccino')) return 'Frappuccinos';
    if (lowerName.includes('refresher') || lowerName.includes('drink')) return 'Refreshers';
    if (lowerName.includes('tea') || lowerName.includes('chai') || lowerName.includes('matcha'))
      return 'Teas';
    if (lowerName.includes('cold brew') || lowerName.includes('nitro')) return 'Cold Brew';
    if (lowerName.includes('iced')) return 'Iced Drinks';
    if (lowerName.includes('mocha') || lowerName.includes('chocolate')) return 'Mocha & Chocolate';

    return 'Espresso & Hot Drinks';
  }
}
