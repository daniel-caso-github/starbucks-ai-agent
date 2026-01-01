import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Drink } from '@domain/entities';
import { DrinkId } from '@domain/value-objects';
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

  constructor(
    @InjectModel(DrinkDocument.name)
    private readonly drinkModel: Model<DrinkDocumentType>,
  ) {}

  /**
   * Saves a drink to MongoDB.
   */
  async save(drink: Drink): Promise<void> {
    this.logger.debug(`Saving drink: ${drink.name}`);

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

    this.logger.debug(`Drink saved: ${drink.id.toString()}`);
  }

  /**
   * Saves multiple drinks in batch.
   * More efficient than calling save() multiple times.
   */
  async saveMany(drinks: Drink[]): Promise<void> {
    this.logger.debug(`Saving ${drinks.length} drinks in batch`);

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
            },
          },
          upsert: true,
        },
      };
    });

    await this.drinkModel.bulkWrite(operations);

    this.logger.log(`Batch saved ${drinks.length} drinks`);
  }

  /**
   * Finds a drink by its unique identifier.
   */
  async findById(id: DrinkId): Promise<Drink | null> {
    this.logger.debug(`Finding drink by ID: ${id.toString()}`);

    const document = await this.drinkModel.findById(id.toString());

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

    // Strategy 1: Exact match (case-insensitive)
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let document = await this.drinkModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });

    if (document) {
      return DrinkMapper.toDomain(document);
    }

    // Strategy 2: Partial match - name contains search term
    document = await this.drinkModel.findOne({
      name: { $regex: new RegExp(escapedName, 'i') },
    });

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

    const documents = await this.drinkModel.find().sort({ name: 1 });

    this.logger.debug(`Found ${documents.length} drinks`);

    return documents.map((doc) => DrinkMapper.toDomain(doc));
  }

  /**
   * Deletes a drink by its ID.
   */
  async delete(id: DrinkId): Promise<boolean> {
    this.logger.debug(`Deleting drink: ${id.toString()}`);

    const result = await this.drinkModel.deleteOne({ _id: id.toString() });
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
    const count = await this.drinkModel.countDocuments();
    this.logger.debug(`Total drinks count: ${count}`);
    return count;
  }
}
