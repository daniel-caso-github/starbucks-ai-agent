import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection, Metadata, Where } from 'chromadb';
import { Drink } from '@domain/entities';
import { CustomizationOptions, DrinkId, Money } from '@domain/value-objects';
import { IDrinkSearcherPort } from '@application/ports/outbound';
import { DrinkSearchFiltersDto, DrinkSearchResultDto } from '@application/dtos/drink-searcher.dto';

/**
 * ChromaDB implementation of IDrinkSearcher.
 *
 * This adapter uses ChromaDB for semantic (vector) search of drinks.
 * It stores drink embeddings and metadata, enabling natural language
 * queries like "something sweet and cold" to find relevant drinks.
 */
@Injectable()
export class ChromaDrinkSearcher implements IDrinkSearcherPort, OnModuleInit {
  private readonly logger = new Logger(ChromaDrinkSearcher.name);
  private client!: ChromaClient;
  private collection!: Collection;
  private readonly collectionName = 'drinks';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize ChromaDB connection when the module starts.
   */
  async onModuleInit(): Promise<void> {
    const chromaHost = this.configService.get<string>('CHROMA_HOST', 'http://localhost:8000');

    this.logger.log(`Connecting to ChromaDB at ${chromaHost}`);

    this.client = new ChromaClient({
      path: chromaHost,
    });

    // Get or create the drinks collection
    this.collection = await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: {
        description: 'Starbucks drinks menu for semantic search',
      },
    });

    this.logger.log(`ChromaDB collection '${this.collectionName}' ready`);
  }

  /**
   * Performs semantic search to find drinks similar to the query.
   */
  async findSimilar(
    query: string,
    limit = 5,
    filters?: DrinkSearchFiltersDto,
  ): Promise<DrinkSearchResultDto[]> {
    const whereClause = this.buildWhereClause(filters);

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: limit,
      ...(whereClause && { where: whereClause }),
    });

    return this.mapQueryResults(results);
  }

  /**
   * Finds a drink by its exact name (case-insensitive).
   */
  async findByName(name: string): Promise<Drink | null> {
    const results = await this.collection.get({
      where: {
        name: { $eq: name.toLowerCase() },
      } as Where,
      limit: 1,
    });

    if (!results.ids.length || !results.metadatas[0]) {
      return null;
    }

    return this.metadataToDrink(results.ids[0], results.metadatas[0]);
  }

  /**
   * Retrieves a drink by its unique identifier.
   */
  async findById(id: DrinkId): Promise<Drink | null> {
    const results = await this.collection.get({
      ids: [id.toString()],
    });

    if (!results.ids.length || !results.metadatas[0]) {
      return null;
    }

    return this.metadataToDrink(results.ids[0], results.metadatas[0]);
  }

  /**
   * Retrieves all drinks from the collection.
   */
  async findAll(): Promise<Drink[]> {
    const results = await this.collection.get({});

    return results.ids
      .map((id, index) => {
        const metadata = results.metadatas[index];
        if (!metadata) return null;
        return this.metadataToDrink(id, metadata);
      })
      .filter((drink): drink is Drink => drink !== null);
  }

  /**
   * Adds a drink to the ChromaDB collection.
   */
  async index(drink: Drink): Promise<void> {
    const metadata = this.drinkToMetadata(drink);
    const document = drink.toSummary();

    await this.collection.upsert({
      ids: [drink.id.toString()],
      documents: [document],
      metadatas: [metadata],
    });
  }

  /**
   * Adds multiple drinks to the collection in batch.
   */
  async indexBatch(drinks: Drink[]): Promise<void> {
    if (drinks.length === 0) return;

    const ids = drinks.map((d) => d.id.toString());
    const documents = drinks.map((d) => d.toSummary());
    const metadatas = drinks.map((d) => this.drinkToMetadata(d));

    await this.collection.upsert({
      ids,
      documents,
      metadatas,
    });
  }

  /**
   * Removes a drink from the collection.
   */
  async removeFromIndex(id: DrinkId): Promise<boolean> {
    try {
      await this.collection.delete({
        ids: [id.toString()],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Builds a ChromaDB where clause from search filters.
   */
  private buildWhereClause(filters?: DrinkSearchFiltersDto): Where | undefined {
    if (!filters) return undefined;

    const conditions: Where[] = [];

    if (filters.maxPrice) {
      conditions.push({
        basePriceCents: { $lte: filters.maxPrice.cents },
      });
    }

    if (filters.minPrice) {
      conditions.push({
        basePriceCents: { $gte: filters.minPrice.cents },
      });
    }

    if (filters.supportsMilk !== undefined) {
      conditions.push({
        supportsMilk: { $eq: filters.supportsMilk },
      });
    }

    if (filters.supportsSize !== undefined) {
      conditions.push({
        supportsSize: { $eq: filters.supportsSize },
      });
    }

    if (filters.supportsSyrup !== undefined) {
      conditions.push({
        supportsSyrup: { $eq: filters.supportsSyrup },
      });
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];

    return { $and: conditions };
  }

  /**
   * Maps ChromaDB query results to DrinkSearchResult array.
   */
  private mapQueryResults(results: {
    ids: string[][];
    distances?: (number | null)[][] | null;
    metadatas: (Metadata | null)[][];
  }): DrinkSearchResultDto[] {
    const ids = results.ids[0] || [];
    const distances = results.distances?.[0] || [];
    const metadatas = results.metadatas[0] || [];

    return ids
      .map((id, index) => {
        const metadata = metadatas[index];
        if (!metadata) return null;

        const distance = distances[index] ?? 0;
        // Convert distance to similarity score (ChromaDB returns L2 distance)
        const score = 1 / (1 + distance);

        return {
          drink: this.metadataToDrink(id, metadata),
          score,
        };
      })
      .filter((result): result is DrinkSearchResultDto => result !== null);
  }

  /**
   * Converts a Drink entity to ChromaDB metadata.
   */
  private drinkToMetadata(drink: Drink): Metadata {
    return {
      name: drink.name.toLowerCase(),
      displayName: drink.name,
      description: drink.description,
      basePriceCents: drink.basePrice.cents,
      currency: drink.basePrice.currency,
      supportsMilk: drink.customizationOptions.milk,
      supportsSyrup: drink.customizationOptions.syrup,
      supportsSweetener: drink.customizationOptions.sweetener,
      supportsTopping: drink.customizationOptions.topping,
      supportsSize: drink.customizationOptions.size,
    };
  }

  /**
   * Converts ChromaDB metadata back to a Drink entity.
   */
  private metadataToDrink(id: string, metadata: Metadata): Drink {
    return Drink.reconstitute({
      id: DrinkId.fromString(id),
      name: String(metadata.displayName || ''),
      description: String(metadata.description || ''),
      basePrice: Money.fromCents(
        Number(metadata.basePriceCents) || 0,
        String(metadata.currency || 'USD'),
      ),
      customizationOptions: new CustomizationOptions(
        Boolean(metadata.supportsMilk),
        Boolean(metadata.supportsSyrup),
        Boolean(metadata.supportsSweetener),
        Boolean(metadata.supportsTopping),
        Boolean(metadata.supportsSize),
      ),
    });
  }
}
