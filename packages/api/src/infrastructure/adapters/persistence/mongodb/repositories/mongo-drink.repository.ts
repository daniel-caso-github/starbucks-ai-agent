import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Drink } from '@domain/entities';
import { DrinkId } from '@domain/value-objects';
import { MetricsService } from '@infrastructure/observability';
import { DrinkDocument, DrinkDocumentType } from '../schemas';
import { DrinkMapper } from '../mappers';
import { IDrinkRepositoryPort } from '@application/ports/outbound/drink-repository.port';

/**
 * MongoDB repository for Drink entities.
 * This handles basic CRUD operations for drinks.
 * Note: Semantic search is handled by ChromaDrinkSearcher, not this repository.
 */
@Injectable()
export class MongoDrinkRepository implements IDrinkRepositoryPort {
  private readonly logger = new Logger(MongoDrinkRepository.name);
  private readonly collectionName = 'drinks';

  constructor(
    @InjectModel(DrinkDocument.name)
    private readonly drinkModel: Model<DrinkDocumentType>,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Saves a drink to MongoDB.
   */
  async save(drink: Drink): Promise<void> {
    this.logger.debug(`Saving drink: ${drink.name}`);
    const startTime = Date.now();

    const document = DrinkMapper.toDocument(drink);

    await this.drinkModel.findByIdAndUpdate(
      document._id,
      {
        $set: {
          name: document.name,
          description: document.description,
          basePriceCents: document.basePriceCents,
          currency: document.currency,
          customizationOptions: document.customizationOptions,
        },
      },
      { upsert: true, new: true },
    );

    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('upsert', this.collectionName, durationSec);

    this.logger.debug(`Drink saved: ${drink.id.toString()}`);
  }

  /**
   * Saves multiple drinks in batch.
   * More efficient than calling save() multiple times.
   */
  async saveMany(drinks: Drink[]): Promise<void> {
    this.logger.debug(`Saving ${drinks.length} drinks in batch`);
    const startTime = Date.now();

    const operations = drinks.map((drink) => {
      const document = DrinkMapper.toDocument(drink);
      return {
        updateOne: {
          filter: { _id: document._id },
          update: {
            $set: {
              name: document.name,
              description: document.description,
              basePriceCents: document.basePriceCents,
              currency: document.currency,
              customizationOptions: document.customizationOptions,
              isHot: document.isHot,
              imageUrl: document.imageUrl,
            },
          },
          upsert: true,
        },
      };
    });

    await this.drinkModel.bulkWrite(operations);

    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('bulkWrite', this.collectionName, durationSec);

    this.logger.log(`Batch saved ${drinks.length} drinks`);
  }

  /**
   * Finds a drink by its unique identifier.
   */
  async findById(id: DrinkId): Promise<Drink | null> {
    this.logger.debug(`Finding drink by ID: ${id.toString()}`);
    const startTime = Date.now();

    const document = await this.drinkModel.findById(id.toString());

    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('findById', this.collectionName, durationSec);

    if (!document) {
      this.logger.debug(`Drink not found: ${id.toString()}`);
      return null;
    }

    return DrinkMapper.toDomain(document);
  }

  /**
   * Finds a drink by name with multiple matching strategies:
   * 1. Exact match (case-insensitive)
   * 2. Partial match (name contains search term)
   */
  async findByName(name: string): Promise<Drink | null> {
    this.logger.debug(`Finding drink by name: ${name}`);
    const startTime = Date.now();

    // Strategy 1: Exact match (case-insensitive)
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let document = await this.drinkModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });

    if (document) {
      const durationSec = (Date.now() - startTime) / 1000;
      this.metricsService.recordDBQuery('findOne', this.collectionName, durationSec);
      return DrinkMapper.toDomain(document);
    }

    // Strategy 2: Partial match - name contains search term
    document = await this.drinkModel.findOne({
      name: { $regex: new RegExp(escapedName, 'i') },
    });

    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('findOne', this.collectionName, durationSec);

    if (document) {
      this.logger.debug(`Partial match found: "${name}" → "${document.name}"`);
      return DrinkMapper.toDomain(document);
    }

    this.logger.debug(`Drink not found by name: ${name}`);
    return null;
  }

  /**
   * Retrieves all drinks from the database.
   */
  async findAll(): Promise<Drink[]> {
    this.logger.debug('Finding all drinks');
    const startTime = Date.now();

    const documents = await this.drinkModel.find().sort({ name: 1 });

    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('find', this.collectionName, durationSec);

    this.logger.debug(`Found ${documents.length} drinks`);

    return documents.map((doc) => DrinkMapper.toDomain(doc));
  }

  /**
   * Deletes a drink by its ID.
   */
  async delete(id: DrinkId): Promise<boolean> {
    this.logger.debug(`Deleting drink: ${id.toString()}`);
    const startTime = Date.now();

    const result = await this.drinkModel.deleteOne({ _id: id.toString() });

    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('delete', this.collectionName, durationSec);

    const deleted = result.deletedCount > 0;

    if (deleted) {
      this.logger.log(`Drink deleted: ${id.toString()}`);
    }

    return deleted;
  }

  /**
   * Counts total number of drinks in the database.
   */
  async count(): Promise<number> {
    const startTime = Date.now();
    const count = await this.drinkModel.countDocuments();
    const durationSec = (Date.now() - startTime) / 1000;
    this.metricsService.recordDBQuery('count', this.collectionName, durationSec);
    this.logger.debug(`Total drinks count: ${count}`);
    return count;
  }
}
