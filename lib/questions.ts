import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from './database';
import { generateId } from './models';
import type { Question } from '@/app/homework/types';
import type { QuestionModel } from './models';

/**
 * Questions service for database operations
 */
export class QuestionsService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get all questions for a homework set
   */
  async getQuestionsByHomeworkSet(homeworkSetId: string): Promise<Question[]> {
    const questions = await this.db
      .collection<QuestionModel>(COLLECTIONS.QUESTIONS)
      .find({ homeworkSetId })
      .sort({ createdAt: 1 }) // Sort by creation order
      .toArray();

    return questions.map(question => ({
      id: question._id?.toString() || question.id,
      prompt: question.prompt,
      instructions: question.instructions,
      starterSql: question.starterSql,
      expectedResultSchema: question.expectedResultSchema,
      gradingRubric: question.gradingRubric,
      datasetId: question.datasetId,
      maxAttempts: question.maxAttempts,
      points: question.points,
      evaluationMode: question.evaluationMode,
    }));
  }

  /**
   * Get a single question by ID
   */
  async getQuestionById(id: string): Promise<Question | null> {
    const question = await this.db
      .collection<QuestionModel>(COLLECTIONS.QUESTIONS)
      .findOne({ 
        $or: [
          { _id: new ObjectId(id) },
          { id: id }
        ]
      });

    if (!question) return null;

    return {
      id: question._id?.toString() || question.id,
      prompt: question.prompt,
      instructions: question.instructions,
      starterSql: question.starterSql,
      expectedResultSchema: question.expectedResultSchema,
      gradingRubric: question.gradingRubric,
      datasetId: question.datasetId,
      maxAttempts: question.maxAttempts,
      points: question.points,
      evaluationMode: question.evaluationMode,
    };
  }

  /**
   * Create a new question
   */
  async createQuestion(questionData: Omit<Question, 'id'> & { homeworkSetId: string }): Promise<Question> {
    const id = generateId();
    
    const question: QuestionModel = {
      id,
      homeworkSetId: questionData.homeworkSetId,
      prompt: questionData.prompt,
      instructions: questionData.instructions,
      starterSql: questionData.starterSql,
      expectedResultSchema: questionData.expectedResultSchema,
      gradingRubric: questionData.gradingRubric,
      datasetId: questionData.datasetId,
      maxAttempts: questionData.maxAttempts,
      points: questionData.points,
      evaluationMode: questionData.evaluationMode,
    };

    await this.db.collection<QuestionModel>(COLLECTIONS.QUESTIONS).insertOne(question);

    return {
      id,
      prompt: questionData.prompt,
      instructions: questionData.instructions,
      starterSql: questionData.starterSql,
      expectedResultSchema: questionData.expectedResultSchema,
      gradingRubric: questionData.gradingRubric,
      datasetId: questionData.datasetId,
      maxAttempts: questionData.maxAttempts,
      points: questionData.points,
      evaluationMode: questionData.evaluationMode,
    };
  }

  /**
   * Update an existing question
   */
  async updateQuestion(id: string, updates: Partial<Omit<Question, 'id'>>): Promise<Question | null> {
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.db
      .collection<QuestionModel>(COLLECTIONS.QUESTIONS)
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
      prompt: result.prompt,
      instructions: result.instructions,
      starterSql: result.starterSql,
      expectedResultSchema: result.expectedResultSchema,
      gradingRubric: result.gradingRubric,
      datasetId: result.datasetId,
      maxAttempts: result.maxAttempts,
      points: result.points,
      evaluationMode: result.evaluationMode,
    };
  }

  /**
   * Delete a question
   */
  async deleteQuestion(id: string): Promise<boolean> {
    const result = await this.db
      .collection<QuestionModel>(COLLECTIONS.QUESTIONS)
      .deleteOne({ 
        $or: [
          { _id: new ObjectId(id) },
          { id: id }
        ]
      });

    return result.deletedCount > 0;
  }

  /**
   * Upsert a question (create or update)
   */
  async upsertQuestion(homeworkSetId: string, questionData: Partial<Question> & { id?: string }): Promise<Question> {
    if (questionData.id) {
      // Try to update existing question
      const existing = await this.updateQuestion(questionData.id, questionData);
      if (existing) {
        return existing;
      }
    }

    // Create new question if update failed or no ID provided
    const newQuestionData: Omit<Question, 'id'> & { homeworkSetId: string } = {
      homeworkSetId,
      prompt: questionData.prompt || "",
      instructions: questionData.instructions || "",
      starterSql: questionData.starterSql,
      expectedResultSchema: questionData.expectedResultSchema || [],
      gradingRubric: questionData.gradingRubric || [],
      datasetId: questionData.datasetId,
      maxAttempts: questionData.maxAttempts || 3,
      points: questionData.points || 10,
      evaluationMode: questionData.evaluationMode,
    };

    return this.createQuestion(newQuestionData);
  }

  /**
   * Delete all questions for a homework set
   */
  async deleteQuestionsByHomeworkSet(homeworkSetId: string): Promise<number> {
    const result = await this.db
      .collection<QuestionModel>(COLLECTIONS.QUESTIONS)
      .deleteMany({ homeworkSetId });

    return result.deletedCount;
  }

  /**
   * Get question count for a homework set
   */
  async getQuestionCount(homeworkSetId: string): Promise<number> {
    return this.db
      .collection<QuestionModel>(COLLECTIONS.QUESTIONS)
      .countDocuments({ homeworkSetId });
  }
}

/**
 * Static service instance
 */
let questionsService: QuestionsService | null = null;

export async function getQuestionsService(): Promise<QuestionsService> {
  if (!questionsService) {
    const { db } = await connectToDatabase();
    questionsService = new QuestionsService(db);
  }
  return questionsService;
}

/**
 * Convenience functions that use the service
 */
export async function getQuestionsByHomeworkSet(homeworkSetId: string): Promise<Question[]> {
  const service = await getQuestionsService();
  return service.getQuestionsByHomeworkSet(homeworkSetId);
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const service = await getQuestionsService();
  return service.getQuestionById(id);
}

export async function createQuestion(questionData: Omit<Question, 'id'> & { homeworkSetId: string }): Promise<Question> {
  const service = await getQuestionsService();
  return service.createQuestion(questionData);
}

export async function updateQuestion(id: string, updates: Partial<Omit<Question, 'id'>>): Promise<Question | null> {
  const service = await getQuestionsService();
  return service.updateQuestion(id, updates);
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const service = await getQuestionsService();
  return service.deleteQuestion(id);
}

export async function upsertQuestion(homeworkSetId: string, questionData: Partial<Question> & { id?: string }): Promise<Question> {
  const service = await getQuestionsService();
  return service.upsertQuestion(homeworkSetId, questionData);
}
