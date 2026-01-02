import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS, executeWithRetry } from './database';
import { generateId, CommentBankEntryModel } from './models';

export interface CommentBankEntry {
  id: string;
  homeworkSetId: string;
  questionId: string;
  comment: string;
  score: number;
  maxScore: number;
  category?: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentBankEntryPayload {
  homeworkSetId: string;
  questionId: string;
  comment: string;
  score: number;
  maxScore: number;
  category?: string;
  createdBy: string;
}

export interface UpdateCommentBankEntryPayload {
  comment?: string;
  score?: number;
  category?: string;
}

const COMMENT_BANK_COLLECTION = 'comment_bank';

/**
 * Comment Bank service for managing reusable grading comments
 */
export class CommentBankService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get all comments for a specific question
   */
  async getCommentsForQuestion(homeworkSetId: string, questionId: string): Promise<CommentBankEntry[]> {
    const comments = await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .find({ homeworkSetId, questionId })
      .sort({ usageCount: -1, updatedAt: -1 })
      .toArray();

    return comments.map(this.toCommentBankEntry);
  }

  /**
   * Get all comments for a homework set
   */
  async getCommentsForHomeworkSet(homeworkSetId: string): Promise<CommentBankEntry[]> {
    const comments = await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .find({ homeworkSetId })
      .sort({ questionId: 1, usageCount: -1 })
      .toArray();

    return comments.map(this.toCommentBankEntry);
  }

  /**
   * Create a new comment bank entry
   */
  async createComment(payload: CreateCommentBankEntryPayload): Promise<CommentBankEntry> {
    const now = new Date().toISOString();
    const id = generateId();

    const entry: CommentBankEntryModel = {
      id,
      homeworkSetId: payload.homeworkSetId,
      questionId: payload.questionId,
      comment: payload.comment,
      score: payload.score,
      maxScore: payload.maxScore,
      category: payload.category,
      usageCount: 0,
      createdBy: payload.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION).insertOne(entry);

    return this.toCommentBankEntry(entry);
  }

  /**
   * Update an existing comment bank entry
   */
  async updateComment(commentId: string, updates: UpdateCommentBankEntryPayload): Promise<CommentBankEntry | null> {
    const now = new Date().toISOString();

    const result = await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .findOneAndUpdate(
        { $or: [{ _id: new ObjectId(commentId) }, { id: commentId }] },
        { 
          $set: { 
            ...updates,
            updatedAt: now 
          } 
        },
        { returnDocument: 'after' }
      );

    if (!result) return null;

    return this.toCommentBankEntry(result);
  }

  /**
   * Delete a comment bank entry
   */
  async deleteComment(commentId: string): Promise<boolean> {
    const result = await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .deleteOne({ $or: [{ _id: new ObjectId(commentId) }, { id: commentId }] });

    return result.deletedCount > 0;
  }

  /**
   * Increment the usage count of a comment
   */
  async incrementUsageCount(commentId: string): Promise<void> {
    await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .updateOne(
        { $or: [{ _id: new ObjectId(commentId) }, { id: commentId }] },
        { 
          $inc: { usageCount: 1 },
          $set: { updatedAt: new Date().toISOString() }
        }
      );
  }

  /**
   * Get a single comment by ID
   */
  async getCommentById(commentId: string): Promise<CommentBankEntry | null> {
    const comment = await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .findOne({ $or: [{ _id: new ObjectId(commentId) }, { id: commentId }] });

    if (!comment) return null;

    return this.toCommentBankEntry(comment);
  }

  /**
   * Search comments by text
   */
  async searchComments(homeworkSetId: string, searchText: string): Promise<CommentBankEntry[]> {
    const comments = await this.db
      .collection<CommentBankEntryModel>(COMMENT_BANK_COLLECTION)
      .find({
        homeworkSetId,
        comment: { $regex: searchText, $options: 'i' }
      })
      .sort({ usageCount: -1 })
      .toArray();

    return comments.map(this.toCommentBankEntry);
  }

  /**
   * Convert database model to API response
   */
  private toCommentBankEntry(model: CommentBankEntryModel): CommentBankEntry {
    return {
      id: model._id?.toString() || model.id,
      homeworkSetId: model.homeworkSetId,
      questionId: model.questionId,
      comment: model.comment,
      score: model.score,
      maxScore: model.maxScore,
      category: model.category,
      usageCount: model.usageCount,
      createdBy: model.createdBy,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }
}

/**
 * Static service instance
 */
let commentBankService: CommentBankService | null = null;

export async function getCommentBankService(): Promise<CommentBankService> {
  if (!commentBankService) {
    const { db } = await connectToDatabase();
    commentBankService = new CommentBankService(db);
  }
  return commentBankService;
}

/**
 * Convenience functions that use the service
 */
export async function getCommentsForQuestion(homeworkSetId: string, questionId: string): Promise<CommentBankEntry[]> {
  const service = await getCommentBankService();
  return service.getCommentsForQuestion(homeworkSetId, questionId);
}

export async function getCommentsForHomeworkSet(homeworkSetId: string): Promise<CommentBankEntry[]> {
  const service = await getCommentBankService();
  return service.getCommentsForHomeworkSet(homeworkSetId);
}

export async function createComment(payload: CreateCommentBankEntryPayload): Promise<CommentBankEntry> {
  const service = await getCommentBankService();
  return service.createComment(payload);
}

export async function updateComment(commentId: string, updates: UpdateCommentBankEntryPayload): Promise<CommentBankEntry | null> {
  const service = await getCommentBankService();
  return service.updateComment(commentId, updates);
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const service = await getCommentBankService();
  return service.deleteComment(commentId);
}

export async function incrementUsageCount(commentId: string): Promise<void> {
  const service = await getCommentBankService();
  return service.incrementUsageCount(commentId);
}

export async function searchComments(homeworkSetId: string, searchText: string): Promise<CommentBankEntry[]> {
  const service = await getCommentBankService();
  return service.searchComments(homeworkSetId, searchText);
}
