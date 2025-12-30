import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectModel(DrinkDocument.name)
    private readonly drinkModel: Model<DrinkDocumentType>,
  ) {}

  /**
   * Saves a drink to MongoDB.
   */
  async save(drink: Drink): Promise<void> {
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
  }

  /**
   * Saves multiple drinks in batch.
   * More efficient than calling save() multiple times.
   */
  async saveMany(drinks: Drink[]): Promise<void> {
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
  }

  /**
   * Finds a drink by its unique identifier.
   */
  async findById(id: DrinkId): Promise<Drink | null> {
    const document = await this.drinkModel.findById(id.toString());

    if (!document) {
      return null;
    }

    return DrinkMapper.toDomain(document);
  }

  /**
   * Finds a drink by its exact name (case-insensitive).
   */
  async findByName(name: string): Promise<Drink | null> {
    const document = await this.drinkModel.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (!document) {
      return null;
    }

    return DrinkMapper.toDomain(document);
  }

  /**
   * Retrieves all drinks from the database.
   */
  async findAll(): Promise<Drink[]> {
    const documents = await this.drinkModel.find().sort({ name: 1 });
    return documents.map((doc) => DrinkMapper.toDomain(doc));
  }

  /**
   * Deletes a drink by its ID.
   */
  async delete(id: DrinkId): Promise<boolean> {
    const result = await this.drinkModel.deleteOne({ _id: id.toString() });
    return result.deletedCount > 0;
  }

  /**
   * Counts total number of drinks in the database.
   */
  async count(): Promise<number> {
    return this.drinkModel.countDocuments();
  }
}
