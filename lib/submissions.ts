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

    // Track student performance for AI analysis (Sprint 3)
    try {
      const { trackStudentPerformance } = await import('@/lib/data-collection-hooks')
      
      // Extract performance data from submission
      const answers = result.answers || {}
      const questionIds = Object.keys(answers)
      
      for (const questionId of questionIds) {
        const answer = answers[questionId] as any
        const grade = answer.feedback?.score || 0
        const errors = this.extractErrorsFromAnswer(answer)
        const attempts = answer.executionCount || 1
        const timeSpent = this.calculateTimeSpent(answer)
        
        await trackStudentPerformance(
          result.studentId,
          result.homeworkSetId,
          questionId,
          grade,
          timeSpent,
          attempts,
          errors
        )
      }
    } catch (trackingError) {
      console.error('Error tracking student performance:', trackingError)
      // Don't fail the main operation if tracking fails
    }

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
   * Extract errors from answer for tracking
   */
  private extractErrorsFromAnswer(answer: any): string[] {
    const errors: string[] = []
    
    if (answer.feedback?.autoNotes) {
      const notes = answer.feedback.autoNotes.toLowerCase()
      if (notes.includes('syntax error')) errors.push('syntax_error')
      if (notes.includes('logical error')) errors.push('logical_error')
      if (notes.includes('missing')) errors.push('missing_element')
      if (notes.includes('incorrect')) errors.push('incorrect_logic')
      if (notes.includes('performance')) errors.push('performance_issue')
    }
    
    return errors
  }

  /**
   * Calculate time spent on question (rough estimate)
   */
  private calculateTimeSpent(answer: any): number {
    // Simple time estimation based on execution count and complexity
    const executionCount = answer.executionCount || 1
    const sqlLength = answer.sql?.length || 0
    
    // Estimate: 2 minutes base + 1 minute per execution + 0.1 minutes per 10 characters
    return Math.round(2 + executionCount + (sqlLength / 10) * 0.1)
  }

  /**
   * Execute SQL for a submission
   */
  async executeSqlForSubmission(payload: SqlExecutionRequest): Promise<SqlExecutionResponse | null> {
    try {
      console.log('🔵 executeSqlForSubmission called with:', {
        setId: payload.setId,
        questionId: payload.questionId,
        studentId: payload.studentId,
        sqlLength: payload.sql?.length
      });
      
      const startTime = Date.now();
      
      // Get the question to find the dataset
      console.log('📝 Looking up question:', payload.questionId);
      const question = await this.db
        .collection(COLLECTIONS.QUESTIONS)
        .findOne({ 
          $or: [
            { _id: new ObjectId(payload.questionId) },
            { id: payload.questionId }
          ]
        });
      
      if (!question) {
        console.error('❌ Question not found:', payload.questionId);
        console.log('Available collections:', await this.db.listCollections().toArray());
        
        // Return error feedback instead of null
        return {
          columns: [],
          rows: [],
          executionMs: Date.now() - startTime,
          truncated: false,
          feedback: {
            questionId: payload.questionId,
            score: 0,
            autoNotes: `Question not found (ID: ${payload.questionId}). Please contact your instructor.`,
            rubricBreakdown: [],
          },
        };
      }
      
      console.log('✅ Question found:', question.id);
      
      // Get the homework set to find the datasetId
      console.log('📚 Looking up homework set:', payload.setId);
      const homeworkSet = await this.db
        .collection(COLLECTIONS.HOMEWORK_SETS)
        .findOne({ 
          $or: [
            { _id: new ObjectId(payload.setId) },
            { id: payload.setId }
          ]
        });
      
      if (!homeworkSet) {
        console.error('❌ Homework set not found:', payload.setId);
        
        // Return error feedback instead of null
        return {
          columns: [],
          rows: [],
          executionMs: Date.now() - startTime,
          truncated: false,
          feedback: {
            questionId: payload.questionId,
            score: 0,
            autoNotes: `Homework set not found (ID: ${payload.setId}). Please contact your instructor.`,
            rubricBreakdown: [],
          },
        };
      }
      
      console.log('✅ Homework set found:', homeworkSet.id);
      
      // Use the question's datasetId if specified, otherwise use the set's datasetId
      const datasetId = question.datasetId || homeworkSet.datasetId;
      
      if (!datasetId) {
        console.warn('⚠️ No dataset specified, will use fallback sample data');
        // Don't return null - continue with sample data
      } else {
        console.log('📊 Dataset ID:', datasetId);
      }
      
      // Get the dataset (if datasetId exists)
      let dataset = null;
      if (datasetId) {
        console.log('🔍 Looking up dataset:', datasetId);
        dataset = await this.db
          .collection(COLLECTIONS.DATASETS)
          .findOne({ 
            $or: [
              { _id: new ObjectId(datasetId) },
              { id: datasetId }
            ]
          });
        
        if (dataset) {
          console.log('✅ Dataset found:', dataset.name);
        } else {
          console.warn('⚠️ Dataset not found, will use fallback');
        }
      }
      
      // If no dataset or no connectionUri, use fallback with sample data
      if (!dataset || !dataset.connectionUri) {
        console.log('📝 Using fallback mode with sample Employees table');
        dataset = {
          id: 'fallback',
          name: 'Sample Database',
          connectionUri: 'fallback://sample',
          description: 'Fallback sample database',
          tags: [],
          updatedAt: new Date().toISOString()
        };
      }
      
      // Import sql.js dynamically
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      });
      
      // Load the database
      let db;
      try {
        // If connectionUri is a URL, fetch it
        if (dataset.connectionUri.startsWith('http')) {
          const response = await fetch(dataset.connectionUri);
          const buffer = await response.arrayBuffer();
          db = new SQL.Database(new Uint8Array(buffer));
        } else {
          // Otherwise treat it as base64 or local path
          // For now, create an empty database with sample data as fallback
          db = new SQL.Database();
          console.warn('⚠️ Using empty database with sample data - connectionUri:', dataset.connectionUri);
          
          // Create a sample Employees table for testing
          try {
            db.run(`
              CREATE TABLE IF NOT EXISTS Employees (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                salary REAL,
                hire_date TEXT
              );
              
              INSERT INTO Employees (id, name, department, salary, hire_date) VALUES
                (1, 'Alice Johnson', 'Engineering', 95000, '2020-01-15'),
                (2, 'Bob Smith', 'Marketing', 75000, '2019-03-22'),
                (3, 'Carol White', 'Engineering', 98000, '2018-07-10'),
                (4, 'David Brown', 'Sales', 68000, '2021-05-30'),
                (5, 'Eve Davis', 'HR', 72000, '2020-11-12');
            `);
            console.log('✅ Created sample Employees table');
          } catch (sampleError) {
            console.error('Error creating sample data:', sampleError);
          }
        }
      } catch (error) {
        console.error('Error loading database:', error);
        db = new SQL.Database();
        
        // Create sample data even on error
        try {
          db.run(`
            CREATE TABLE IF NOT EXISTS Employees (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              department TEXT,
              salary REAL,
              hire_date TEXT
            );
            
            INSERT INTO Employees (id, name, department, salary, hire_date) VALUES
              (1, 'Alice Johnson', 'Engineering', 95000, '2020-01-15'),
              (2, 'Bob Smith', 'Marketing', 75000, '2019-03-22'),
              (3, 'Carol White', 'Engineering', 98000, '2018-07-10'),
              (4, 'David Brown', 'Sales', 68000, '2021-05-30'),
              (5, 'Eve Davis', 'HR', 72000, '2020-11-12');
          `);
        } catch (sampleError) {
          console.error('Error creating sample data after error:', sampleError);
        }
      }
      
      // Execute the SQL query
      let result;
      try {
        result = db.exec(payload.sql);
      } catch (sqlError: any) {
        const executionMs = Date.now() - startTime;
        return {
          columns: [],
          rows: [],
          executionMs,
          truncated: false,
          feedback: {
            questionId: payload.questionId,
            score: 0,
            autoNotes: `SQL Error: ${sqlError.message || 'Invalid SQL syntax'}`,
            rubricBreakdown: [],
          },
        };
      }
      
      const executionMs = Date.now() - startTime;
      
      // Convert SQL.js result format to our format
      if (!result || result.length === 0) {
        return {
          columns: [],
          rows: [],
          executionMs,
          truncated: false,
          feedback: {
            questionId: payload.questionId,
            score: 5,
            autoNotes: 'Query executed successfully but returned no results.',
            rubricBreakdown: [],
          },
        };
      }
      
      const columns = result[0].columns;
      const rows = result[0].values.map(row => {
        const rowObj: any = {};
        columns.forEach((col, i) => {
          rowObj[col] = row[i];
        });
        return rowObj;
      });
      
      // Truncate if too many rows
      const maxRows = 50;
      const truncated = rows.length > maxRows;
      const truncatedRows = truncated ? rows.slice(0, maxRows) : rows;
      
      // Simple scoring based on result
      const score = rows.length > 0 ? 8 : 5;
      
      db.close();
      
      return {
        columns,
        rows: truncatedRows,
        executionMs,
        truncated,
        feedback: {
          questionId: payload.questionId,
          score,
          autoNotes: rows.length > 0 
            ? `Query executed successfully. Returned ${rows.length} row(s).` 
            : 'Query executed but returned no results.',
          rubricBreakdown: [],
        },
      };
    } catch (error: any) {
      console.error('❌❌❌ CRITICAL ERROR in executeSqlForSubmission:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      return {
        columns: [],
        rows: [],
        executionMs: 0,
        truncated: false,
        feedback: {
          questionId: payload.questionId,
          score: 0,
          autoNotes: `System error: ${error.message || 'Unknown error'}. Check server logs for details.`,
          rubricBreakdown: [],
        },
      };
    }
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
