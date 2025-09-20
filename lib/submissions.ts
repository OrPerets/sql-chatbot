import { Db, ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from './database';
import { generateId } from './models';
import type { 
  Submission, 
  SubmissionSummary,
  QuestionProgress,
  SqlExecutionRequest,
  SqlExecutionResponse,
  SaveSubmissionDraftPayload
} from '@/app/homework/types';
import type { SubmissionModel } from './models';

/**
 * Submissions service for database operations
 */
export class SubmissionsService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get submission for a specific student and homework set
   */
  async getSubmissionForStudent(homeworkSetId: string, studentId: string): Promise<Submission | null> {
    const submission = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOne({ 
        homeworkSetId,
        studentId 
      });

    if (!submission) return null;

    return {
      id: submission._id?.toString() || submission.id,
      homeworkSetId: submission.homeworkSetId,
      studentId: submission.studentId,
      attemptNumber: submission.attemptNumber,
      answers: submission.answers,
      overallScore: submission.overallScore,
      status: submission.status,
      submittedAt: submission.submittedAt,
      gradedAt: submission.gradedAt,
    };
  }

  /**
   * Get a submission by ID
   */
  async getSubmissionById(submissionId: string): Promise<Submission | null> {
    const submission = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOne({ 
        $or: [
          { _id: new ObjectId(submissionId) },
          { id: submissionId }
        ]
      });

    if (!submission) return null;

    return {
      id: submission._id?.toString() || submission.id,
      homeworkSetId: submission.homeworkSetId,
      studentId: submission.studentId,
      attemptNumber: submission.attemptNumber,
      answers: submission.answers,
      overallScore: submission.overallScore,
      status: submission.status,
      submittedAt: submission.submittedAt,
      gradedAt: submission.gradedAt,
    };
  }

  /**
   * Get submission summaries for a homework set
   */
  async getSubmissionSummaries(homeworkSetId: string): Promise<SubmissionSummary[]> {
    const submissions = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .find({ homeworkSetId })
      .toArray();

    // Get question count for progress calculation
    const questionCount = await this.db
      .collection(COLLECTIONS.QUESTIONS)
      .countDocuments({ homeworkSetId });

    return submissions.map(submission => {
      const answered = Object.values(submission.answers).filter(
        answer => Boolean(answer?.sql?.trim()) || Boolean(answer?.feedback?.score)
      ).length;

      return {
        id: submission._id?.toString() || submission.id,
        studentId: submission.studentId,
        status: submission.status,
        overallScore: submission.overallScore,
        submittedAt: submission.submittedAt,
        gradedAt: submission.gradedAt,
        attemptNumber: submission.attemptNumber,
        progress: Math.min(1, Number((answered / Math.max(questionCount, 1)).toFixed(2))),
      };
    });
  }

  /**
   * Create or update a submission draft
   */
  async saveSubmissionDraft(homeworkSetId: string, payload: SaveSubmissionDraftPayload): Promise<Submission> {
    const now = new Date().toISOString();
    
    // Check if submission already exists
    const existing = await this.getSubmissionForStudent(homeworkSetId, payload.studentId);
    
    if (existing) {
      // Update existing submission
      const updateData: Partial<SubmissionModel> = {
        answers: { ...existing.answers, ...payload.answers },
        status: "in_progress",
        updatedAt: now,
      };

      const result = await this.db
        .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
        .findOneAndUpdate(
          { _id: new ObjectId(existing.id) },
          { $set: updateData },
          { returnDocument: 'after' }
        );

      if (!result) throw new Error('Failed to update submission');

      return {
        id: result._id?.toString() || result.id,
        homeworkSetId: result.homeworkSetId,
        studentId: result.studentId,
        attemptNumber: result.attemptNumber,
        answers: result.answers,
        overallScore: result.overallScore,
        status: result.status,
        submittedAt: result.submittedAt,
        gradedAt: result.gradedAt,
      };
    } else {
      // Create new submission
      const id = generateId();
      const submission: SubmissionModel = {
        id,
        homeworkSetId,
        studentId: payload.studentId,
        attemptNumber: 1,
        answers: payload.answers || {},
        overallScore: 0,
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      };

      await this.db.collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS).insertOne(submission);

      return {
        id,
        homeworkSetId,
        studentId: payload.studentId,
        attemptNumber: 1,
        answers: payload.answers || {},
        overallScore: 0,
        status: "in_progress",
      };
    }
  }

  /**
   * Submit a submission (mark as submitted)
   */
  async submitSubmission(homeworkSetId: string, studentId: string): Promise<Submission | null> {
    const now = new Date().toISOString();
    
    const result = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOneAndUpdate(
        { homeworkSetId, studentId },
        { 
          $set: {
            status: "submitted",
            submittedAt: now,
            updatedAt: now,
          },
          $inc: {
            attemptNumber: 1
          }
        },
        { returnDocument: 'after' }
      );

    if (!result) return null;

    return {
      id: result._id?.toString() || result.id,
      homeworkSetId: result.homeworkSetId,
      studentId: result.studentId,
      attemptNumber: result.attemptNumber,
      answers: result.answers,
      overallScore: result.overallScore,
      status: result.status,
      submittedAt: result.submittedAt,
      gradedAt: result.gradedAt,
    };
  }

  /**
   * Grade a submission
   */
  async gradeSubmission(submissionId: string, updates: Partial<Submission>): Promise<Submission | null> {
    const now = new Date().toISOString();
    
    const updateData: Partial<SubmissionModel> = {
      ...updates,
      gradedAt: now,
      updatedAt: now,
    };

    const result = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOneAndUpdate(
        { 
          $or: [
            { _id: new ObjectId(submissionId) },
            { id: submissionId }
          ]
        },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    if (!result) return null;

    return {
      id: result._id?.toString() || result.id,
      homeworkSetId: result.homeworkSetId,
      studentId: result.studentId,
      attemptNumber: result.attemptNumber,
      answers: result.answers,
      overallScore: result.overallScore,
      status: result.status,
      submittedAt: result.submittedAt,
      gradedAt: result.gradedAt,
    };
  }

  /**
   * Execute SQL for a submission (mock implementation)
   */
  async executeSqlForSubmission(payload: SqlExecutionRequest): Promise<SqlExecutionResponse | null> {
    // This is a simplified mock implementation
    // In a real system, this would integrate with a SQL execution service
    
    const mockResponse: SqlExecutionResponse = {
      columns: ['result'],
      rows: [{ result: 'Mock execution result' }],
      executionMs: 150,
      truncated: false,
      feedback: {
        questionId: payload.questionId,
        score: 8,
        autoNotes: 'Mock feedback - implement real SQL execution',
        rubricBreakdown: [],
      },
    };

    return mockResponse;
  }

  /**
   * Get question progress for a submission
   */
  async getSubmissionProgress(submissionId: string): Promise<QuestionProgress[] | null> {
    const submission = await this.getSubmissionById(submissionId);
    if (!submission) return null;

    // Get questions for this homework set
    const questions = await this.db
      .collection(COLLECTIONS.QUESTIONS)
      .find({ homeworkSetId: submission.homeworkSetId })
      .toArray();

    return questions.map(question => {
      const answer = submission.answers[question.id];
      const maxPoints = question.points || 0;
      const earned = Math.min(maxPoints, Math.max(0, answer?.feedback?.score || 0));
      
      return {
        questionId: question.id,
        attempts: answer?.executionCount || 0,
        lastExecutedAt: answer?.lastExecutedAt,
        completed: earned > 0 || submission.status !== "in_progress",
        earnedScore: earned,
      };
    });
  }
}

/**
 * Static service instance
 */
let submissionsService: SubmissionsService | null = null;

export async function getSubmissionsService(): Promise<SubmissionsService> {
  if (!submissionsService) {
    const { db } = await connectToDatabase();
    submissionsService = new SubmissionsService(db);
  }
  return submissionsService;
}

/**
 * Convenience functions that use the service
 */
export async function getSubmissionForStudent(homeworkSetId: string, studentId: string): Promise<Submission | null> {
  const service = await getSubmissionsService();
  return service.getSubmissionForStudent(homeworkSetId, studentId);
}

export async function getSubmissionById(submissionId: string): Promise<Submission | null> {
  const service = await getSubmissionsService();
  return service.getSubmissionById(submissionId);
}

export async function getSubmissionSummaries(homeworkSetId: string): Promise<SubmissionSummary[]> {
  const service = await getSubmissionsService();
  return service.getSubmissionSummaries(homeworkSetId);
}

export async function saveSubmissionDraft(homeworkSetId: string, payload: SaveSubmissionDraftPayload): Promise<Submission> {
  const service = await getSubmissionsService();
  return service.saveSubmissionDraft(homeworkSetId, payload);
}

export async function submitSubmission(homeworkSetId: string, studentId: string): Promise<Submission | null> {
  const service = await getSubmissionsService();
  return service.submitSubmission(homeworkSetId, studentId);
}

export async function gradeSubmission(submissionId: string, updates: Partial<Submission>): Promise<Submission | null> {
  const service = await getSubmissionsService();
  return service.gradeSubmission(submissionId, updates);
}

export async function executeSqlForSubmission(payload: SqlExecutionRequest): Promise<SqlExecutionResponse | null> {
  const service = await getSubmissionsService();
  return service.executeSqlForSubmission(payload);
}
