import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database';
import { generateId } from './models';
import type { Dataset, PaginatedResponse } from '@/app/homework/types';
import type { DatasetModel } from './models';

/**
 * Dataset service for database operations
 */
export class DatasetService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get all datasets with optional filtering and pagination
   */
  async listDatasets(params?: {
    search?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<Dataset>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const skip = (page - 1) * pageSize;

    // Build filter query
    const filter: any = {};
    
    if (params?.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { description: { $regex: params.search, $options: 'i' } },
      ];
    }
    
    if (params?.tags && params.tags.length > 0) {
      filter.tags = { $in: params.tags };
    }

    const [items, totalItems] = await Promise.all([
      this.db
        .collection<DatasetModel>(COLLECTIONS.DATASETS)
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      this.db
        .collection<DatasetModel>(COLLECTIONS.DATASETS)
        .countDocuments(filter),
    ]);

    return {
      items: items.map(item => ({
        id: item._id?.toString() || item.id,
        name: item.name,
        description: item.description,
        scenario: item.scenario,
        story: item.story,
        connectionUri: item.connectionUri,
        previewTables: item.previewTables,
        tags: item.tags,
        updatedAt: item.updatedAt,
      })),
      page,
      totalPages: Math.ceil(totalItems / pageSize) || 1,
      totalItems,
    };
  }

  /**
   * Get a single dataset by ID
   */
  async getDatasetById(id: string): Promise<Dataset | null> {
    const dataset = await this.db
      .collection<DatasetModel>(COLLECTIONS.DATASETS)
      .findOne({ 
        $or: [
          { _id: new ObjectId(id) },
          { id: id }
        ]
      });

    if (!dataset) return null;

    return {
      id: dataset._id?.toString() || dataset.id,
      name: dataset.name,
      description: dataset.description,
      scenario: dataset.scenario,
      story: dataset.story,
      connectionUri: dataset.connectionUri,
      previewTables: dataset.previewTables,
      tags: dataset.tags,
      updatedAt: dataset.updatedAt,
    };
  }

  /**
   * Create a new dataset
   */
  async createDataset(datasetData: Omit<Dataset, 'id' | 'updatedAt'>): Promise<Dataset> {
    const id = generateId();
    const now = new Date().toISOString();
    
    const dataset: DatasetModel = {
      id,
      ...datasetData,
      updatedAt: now,
    };

    await this.db.collection<DatasetModel>(COLLECTIONS.DATASETS).insertOne(dataset);

    return {
      id,
      ...datasetData,
      updatedAt: now,
    };
  }

  /**
   * Update an existing dataset
   */
  async updateDataset(id: string, updates: Partial<Omit<Dataset, 'id'>>): Promise<Dataset | null> {
    const now = new Date().toISOString();
    const updateData = {
      ...updates,
      updatedAt: now,
    };

    const result = await this.db
      .collection<DatasetModel>(COLLECTIONS.DATASETS)
      .findOneAndUpdate(
        { 
          $or: [
            { _id: new ObjectId(id) },
            { id: id }
          ]
        },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    if (!result) return null;

    return {
      id: result._id?.toString() || result.id,
      name: result.name,
      description: result.description,
      scenario: result.scenario,
      story: result.story,
      connectionUri: result.connectionUri,
      previewTables: result.previewTables,
      tags: result.tags,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(id: string): Promise<boolean> {
    const result = await this.db
      .collection<DatasetModel>(COLLECTIONS.DATASETS)
      .deleteOne({ 
        $or: [
          { _id: new ObjectId(id) },
          { id: id }
        ]
      });

    return result.deletedCount > 0;
  }

  /**
   * Get all unique tags across datasets
   */
  async getUniqueTags(): Promise<string[]> {
    const tags = await this.db
      .collection<DatasetModel>(COLLECTIONS.DATASETS)
      .distinct('tags');

    return tags.filter(tag => tag && typeof tag === 'string');
  }
}

/**
 * Static service instance
 */
let datasetService: DatasetService | null = null;

export async function getDatasetService(): Promise<DatasetService> {
  if (!datasetService) {
    const { db } = await connectToDatabase();
    datasetService = new DatasetService(db);
  }
  return datasetService;
}

/**
 * Convenience functions that use the service
 */
export async function listDatasets(params?: {
  search?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Dataset>> {
  const service = await getDatasetService();
  return service.listDatasets(params);
}

export async function getDatasetById(id: string): Promise<Dataset | null> {
  const service = await getDatasetService();
  return service.getDatasetById(id);
}

export async function createDataset(datasetData: Omit<Dataset, 'id' | 'updatedAt'>): Promise<Dataset> {
  const service = await getDatasetService();
  return service.createDataset(datasetData);
}

export async function updateDataset(id: string, updates: Partial<Omit<Dataset, 'id'>>): Promise<Dataset | null> {
  const service = await getDatasetService();
  return service.updateDataset(id, updates);
}

export async function deleteDataset(id: string): Promise<boolean> {
  const service = await getDatasetService();
  return service.deleteDataset(id);
}

export async function getUniqueTags(): Promise<string[]> {
  const service = await getDatasetService();
  return service.getUniqueTags();
}
