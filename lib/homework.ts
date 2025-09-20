import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from './database';
import { generateId } from './models';
import type { 
  HomeworkSet, 
  HomeworkSummary, 
  HomeworkQueryParams,
  PaginatedResponse 
} from '@/app/homework/types';
import type { HomeworkSetModel } from './models';

/**
 * Homework service for database operations
 */
export class HomeworkService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get all homework sets with filtering and pagination
   */
  async listHomeworkSets(params?: {
    courseId?: string;
    status?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<HomeworkSummary>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const skip = (page - 1) * pageSize;

    // Build filter query
    const filter: any = {};
    
    if (params?.courseId) {
      filter.courseId = params.courseId;
    }
    
    if (params?.status && params.status.length > 0) {
      // Map status filters to visibility and published fields
      const statusConditions = [];
      
      if (params.status.includes('draft')) {
        statusConditions.push({ visibility: 'draft', published: false });
      }
      if (params.status.includes('scheduled')) {
        statusConditions.push({ visibility: 'draft', published: true });
      }
      if (params.status.includes('published')) {
        statusConditions.push({ visibility: 'published', published: true });
      }
      if (params.status.includes('archived')) {
        statusConditions.push({ visibility: 'archived' });
      }
      
      if (statusConditions.length > 0) {
        filter.$or = statusConditions;
      }
    }

    const [homeworkSets, totalItems] = await Promise.all([
      this.db
        .collection<HomeworkSetModel>(COLLECTIONS.HOMEWORK_SETS)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      this.db
        .collection<HomeworkSetModel>(COLLECTIONS.HOMEWORK_SETS)
        .countDocuments(filter),
    ]);

    // Get question counts and submission stats for each homework set
    const homeworkSummaries = await Promise.all(
      homeworkSets.map(async (homework) => {
        const [questionCount, submissionStats] = await Promise.all([
          this.getQuestionCount(homework.id),
          this.getSubmissionStats(homework.id),
        ]);

        return {
          id: homework._id?.toString() || homework.id,
          title: homework.title,
          courseId: homework.courseId,
          dueAt: homework.dueAt,
          published: homework.published,
          datasetPolicy: homework.datasetPolicy,
          questionOrder: homework.questionOrder,
          visibility: homework.visibility,
          createdBy: homework.createdBy,
          createdAt: homework.createdAt,
          updatedAt: homework.updatedAt,
          overview: homework.overview,
          draftQuestionCount: questionCount,
          submissionCount: submissionStats.total,
          averageScore: submissionStats.averageScore,
        } as HomeworkSummary;
      })
    );

    return {
      items: homeworkSummaries,
      page,
      totalPages: Math.ceil(totalItems / pageSize) || 1,
      totalItems,
    };
  }

  /**
   * Get a single homework set by ID
   */
  async getHomeworkSetById(id: string): Promise<HomeworkSet | null> {
    const homework = await this.db
      .collection<HomeworkSetModel>(COLLECTIONS.HOMEWORK_SETS)
      .findOne({ 
        $or: [
          { _id: new ObjectId(id) },
          { id: id }
        ]
      });

    if (!homework) return null;

    return {
      id: homework._id?.toString() || homework.id,
      title: homework.title,
      courseId: homework.courseId,
      dueAt: homework.dueAt,
      published: homework.published,
      datasetPolicy: homework.datasetPolicy,
      questionOrder: homework.questionOrder,
      visibility: homework.visibility,
      createdBy: homework.createdBy,
      createdAt: homework.createdAt,
      updatedAt: homework.updatedAt,
      overview: homework.overview,
    };
  }

  /**
   * Create a new homework set
   */
  async createHomeworkSet(homeworkData: Omit<HomeworkSet, 'id' | 'createdAt' | 'updatedAt'>): Promise<HomeworkSet> {
    const id = generateId();
    const now = new Date().toISOString();
    
    const homework: HomeworkSetModel = {
      id,
      ...homeworkData,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection<HomeworkSetModel>(COLLECTIONS.HOMEWORK_SETS).insertOne(homework);

    return {
      id,
      ...homeworkData,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update an existing homework set
   */
  async updateHomeworkSet(id: string, updates: Partial<Omit<HomeworkSet, 'id' | 'createdAt'>>): Promise<HomeworkSet | null> {
    const now = new Date().toISOString();
    const updateData = {
      ...updates,
      updatedAt: now,
    };

    const result = await this.db
      .collection<HomeworkSetModel>(COLLECTIONS.HOMEWORK_SETS)
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
      title: result.title,
      courseId: result.courseId,
      dueAt: result.dueAt,
      published: result.published,
      datasetPolicy: result.datasetPolicy,
      questionOrder: result.questionOrder,
      visibility: result.visibility,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      overview: result.overview,
    };
  }

  /**
   * Delete a homework set
   */
  async deleteHomeworkSet(id: string): Promise<boolean> {
    const result = await this.db
      .collection<HomeworkSetModel>(COLLECTIONS.HOMEWORK_SETS)
      .deleteOne({ 
        $or: [
          { _id: new ObjectId(id) },
          { id: id }
        ]
      });

    return result.deletedCount > 0;
  }

  /**
   * Publish/unpublish a homework set
   */
  async publishHomeworkSet(id: string, published: boolean): Promise<HomeworkSet | null> {
    const updates: Partial<HomeworkSet> = {
      published,
      visibility: published ? 'published' : 'draft',
    };

    return this.updateHomeworkSet(id, updates);
  }

  /**
   * Get question count for a homework set
   */
  private async getQuestionCount(homeworkSetId: string): Promise<number> {
    return this.db
      .collection(COLLECTIONS.QUESTIONS)
      .countDocuments({ homeworkSetId });
  }

  /**
   * Get submission statistics for a homework set
   */
  private async getSubmissionStats(homeworkSetId: string): Promise<{ total: number; averageScore?: number }> {
    const submissions = await this.db
      .collection(COLLECTIONS.SUBMISSIONS)
      .find({ 
        homeworkSetId,
        status: 'graded'
      })
      .toArray();

    const total = submissions.length;
    const averageScore = total > 0 
      ? submissions.reduce((sum, sub) => sum + (sub.overallScore || 0), 0) / total
      : undefined;

    return { total, averageScore };
  }
}

/**
 * Static service instance
 */
let homeworkService: HomeworkService | null = null;

export async function getHomeworkService(): Promise<HomeworkService> {
  if (!homeworkService) {
    const { db } = await connectToDatabase();
    homeworkService = new HomeworkService(db);
  }
  return homeworkService;
}

/**
 * Convenience functions that use the service
 */
export async function listHomeworkSets(params?: {
  courseId?: string;
  status?: string[];
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<HomeworkSummary>> {
  const service = await getHomeworkService();
  return service.listHomeworkSets(params);
}

export async function getHomeworkSetById(id: string): Promise<HomeworkSet | null> {
  const service = await getHomeworkService();
  return service.getHomeworkSetById(id);
}

export async function createHomeworkSet(homeworkData: Omit<HomeworkSet, 'id' | 'createdAt' | 'updatedAt'>): Promise<HomeworkSet> {
  const service = await getHomeworkService();
  return service.createHomeworkSet(homeworkData);
}

export async function updateHomeworkSet(id: string, updates: Partial<Omit<HomeworkSet, 'id' | 'createdAt'>>): Promise<HomeworkSet | null> {
  const service = await getHomeworkService();
  return service.updateHomeworkSet(id, updates);
}

export async function deleteHomeworkSet(id: string): Promise<boolean> {
  const service = await getHomeworkService();
  return service.deleteHomeworkSet(id);
}

export async function publishHomeworkSet(id: string, published: boolean): Promise<HomeworkSet | null> {
  const service = await getHomeworkService();
  return service.publishHomeworkSet(id, published);
}
