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
    // Handle both ObjectId and string formats for homeworkSetId
    // Since homeworkSetId is stored as string in the database, we need to convert ObjectId to string for comparison
    const isValidObjectId = ObjectId.isValid(homeworkSetId);
    const query: any = isValidObjectId
      ? {
          $or: [
            { homeworkSetId: new ObjectId(homeworkSetId).toString() },
            { homeworkSetId: homeworkSetId }
          ],
          studentId
        }
      : { homeworkSetId, studentId };

    const submission = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOne(query);

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
      studentTableData: submission.studentTableData,
      aiCommitment: submission.aiCommitment,
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
      studentTableData: submission.studentTableData,
      aiCommitment: submission.aiCommitment,
    };
  }

  /**
   * Get submission summaries for a homework set
   */
  async getSubmissionSummaries(homeworkSetId: string): Promise<SubmissionSummary[]> {
    // Handle both ObjectId and string formats for homeworkSetId
    // Since homeworkSetId is stored as string in the database, we need to convert ObjectId to string for comparison
    const isValidObjectId = ObjectId.isValid(homeworkSetId);
    const query: any = isValidObjectId
      ? { 
          $or: [
            { homeworkSetId: new ObjectId(homeworkSetId).toString() },
            { homeworkSetId: homeworkSetId }
          ]
        }
      : { homeworkSetId };

    const submissions = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .find(query)
      .toArray();

    // Get question count for progress calculation
    const questionQuery: any = isValidObjectId
      ? {
          $or: [
            { homeworkSetId: new ObjectId(homeworkSetId).toString() },
            { homeworkSetId: homeworkSetId }
          ]
        }
      : { homeworkSetId };
    
    const questionCount = await this.db
      .collection(COLLECTIONS.QUESTIONS)
      .countDocuments(questionQuery);

    // Fetch user data for all students to get their names and ID numbers
    const studentIds = submissions.map(s => s.studentId);
    const users = await this.db
      .collection(COLLECTIONS.USERS)
      .find({ 
        $or: [
          { email: { $in: studentIds } },
          { id: { $in: studentIds } }
        ]
      })
      .toArray();

    // Create a map of studentId -> user data
    const userMap = new Map<string, { name?: string; studentIdNumber?: string }>();
    users.forEach((user: any) => {
      const key = user.email || user.id;
      userMap.set(key, {
        name: user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined),
        studentIdNumber: user.studentIdNumber,
      });
    });

    return submissions.map(submission => {
      const answered = Object.values(submission.answers).filter(
        answer => Boolean(answer?.sql?.trim()) || Boolean(answer?.feedback?.score)
      ).length;

      const userData = userMap.get(submission.studentId);

      return {
        id: submission._id?.toString() || submission.id,
        studentId: submission.studentId,
        studentIdNumber: userData?.studentIdNumber,
        studentName: userData?.name,
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
        aiCommitment: result.aiCommitment,
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
        aiCommitment: undefined,
      };
    }
  }

  /**
   * Update student table data for a submission
   */
  async updateSubmissionTableData(
    homeworkSetId: string,
    studentId: string,
    tableData: Record<string, any[]>
  ): Promise<void> {
    await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .updateOne(
        { homeworkSetId, studentId },
        { $set: { studentTableData: tableData } }
      );
  }

  /**
   * Get or assign student-specific table data for Exercise 3
   * This ensures each student gets a consistent, unique subset of data
   */
  async getOrAssignStudentTableData(
    studentId: string,
    homeworkSetId: string
  ): Promise<Record<string, any[]>> {
    // Get existing submission
    const submission = await this.getSubmissionForStudent(homeworkSetId, studentId);
    
    // If submission exists and has table data, return it
    if (submission?.studentTableData && Object.keys(submission.studentTableData).length > 0) {
      console.log('✅ Using existing student table data from submission');
      return submission.studentTableData;
    }
    
    // Otherwise, generate new assignment
    console.log('📝 Generating new student-specific table data');
    const { assignStudentTableData } = await import('./student-data-assignment');
    const assignedData = assignStudentTableData(studentId, homeworkSetId);
    
    // Save to submission (create if doesn't exist)
    if (!submission) {
      await this.saveSubmissionDraft(homeworkSetId, {
        studentId,
        answers: {},
      });
    }
    
    // Update submission with assigned data
    await this.updateSubmissionTableData(homeworkSetId, studentId, assignedData);
    
    console.log('✅ Saved student-specific table data to submission');
    return assignedData;
  }

  /**
   * Submit a submission (mark as submitted)
   */
  async submitSubmission(
    homeworkSetId: string,
    studentId: string,
    aiCommitment?: Submission["aiCommitment"],
  ): Promise<Submission | null> {
    const now = new Date().toISOString();
    
    // Handle both ObjectId and string formats for homeworkSetId
    // Since homeworkSetId is stored as string in the database, we need to convert ObjectId to string for comparison
    const isValidObjectId = ObjectId.isValid(homeworkSetId);
    const query: any = isValidObjectId
      ? {
          $or: [
            { homeworkSetId: new ObjectId(homeworkSetId).toString() },
            { homeworkSetId: homeworkSetId }
          ],
          studentId
        }
      : { homeworkSetId, studentId };
    
    const result = await this.db
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .findOneAndUpdate(
        query,
        {
          $set: {
            status: "submitted",
            submittedAt: now,
            updatedAt: now,
            aiCommitment,
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
      aiCommitment: result.aiCommitment,
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

    // Log what we're about to save for debugging
    if (updates.answers) {
      const answersWithNotes = Object.entries(updates.answers).filter(([_, ans]: [string, any]) => 
        ans.feedback?.instructorNotes?.trim()
      );
      console.log(`[DB Save] Submission ${submissionId}: Saving ${answersWithNotes.length} answers with instructorNotes`);
      if (answersWithNotes.length > 0) {
        const sample = answersWithNotes[0];
        console.log(`[DB Save] Sample answer ${sample[0]}:`, {
          hasFeedback: !!sample[1].feedback,
          instructorNotes: sample[1].feedback?.instructorNotes?.substring(0, 100),
          score: sample[1].feedback?.score,
        });
      }
    }

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

    if (!result) {
      console.error(`[DB Save] Failed to find/update submission ${submissionId}`);
      return null;
    }

    // Log what was actually saved
    const savedAnswersWithNotes = Object.entries(result.answers || {}).filter(([_, ans]: [string, any]) => 
      ans.feedback?.instructorNotes?.trim()
    );
    console.log(`[DB Save] Submission ${submissionId}: After save, found ${savedAnswersWithNotes.length} answers with instructorNotes`);
    if (savedAnswersWithNotes.length === 0 && updates.answers) {
      const expectedWithNotes = Object.entries(updates.answers).filter(([_, ans]: [string, any]) => 
        ans.feedback?.instructorNotes?.trim()
      );
      if (expectedWithNotes.length > 0) {
        console.error(`[DB Save] ❌ CRITICAL: Expected ${expectedWithNotes.length} answers with notes, but got 0 after save!`);
        console.error(`[DB Save] Expected sample:`, {
          questionId: expectedWithNotes[0][0],
          instructorNotes: expectedWithNotes[0][1].feedback?.instructorNotes?.substring(0, 100),
        });
      }
    }

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
      aiCommitment: result.aiCommitment,
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
      
      // Use in-memory alasql via wrapper (alasql package default is alasql.fs.js which pulls in react-native-fs)
      const alasqlModule = await import('./alasql-server.cjs');
      const alasql = alasqlModule.default ?? alasqlModule;
      
      // Helper function to calculate date difference in days (MySQL DATEDIFF compatibility)
      const calculateDateDiff = (date1: string | Date, date2: string | Date): number => {
        const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
        const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
          return null as any; // Return null for invalid dates
        }
        const diffTime = d1.getTime() - d2.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      };
      
      // Helper function for MySQL STRCMP compatibility (returns -1, 0, or 1)
      const strcmp = (str1: string | null | undefined, str2: string | null | undefined): number => {
        // Handle null/undefined
        if (str1 === null || str1 === undefined) {
          return str2 === null || str2 === undefined ? 0 : -1;
        }
        if (str2 === null || str2 === undefined) {
          return 1;
        }
        
        // Convert to strings if needed
        const s1 = String(str1);
        const s2 = String(str2);
        
        // Compare strings (MySQL STRCMP is case-sensitive)
        if (s1 < s2) return -1;
        if (s1 > s2) return 1;
        return 0;
      };
      
      // Register MySQL-compatible DATEDIFF function for alasql
      // Register it so it can be called directly from SQL queries
      // CONCAT: concatenate all arguments as strings (MySQL/SQL compatible)
      const concatFn = (...args: unknown[]) => (args || []).map(String).join('');
      if (alasql.fn) {
        alasql.fn.DATEDIFF = calculateDateDiff;
        alasql.fn.datediff = calculateDateDiff;
        alasql.fn.STRCMP = strcmp;
        alasql.fn.strcmp = strcmp;
        alasql.fn.CONCAT = concatFn;
        alasql.fn.concat = concatFn;
        console.log('✅ Registered DATEDIFF, STRCMP, and CONCAT in alasql.fn');
      }
      if (typeof (alasql as any).fn === 'object') {
        (alasql as any).fn.DATEDIFF = calculateDateDiff;
        (alasql as any).fn.datediff = calculateDateDiff;
        (alasql as any).fn.STRCMP = strcmp;
        (alasql as any).fn.strcmp = strcmp;
        (alasql as any).fn.CONCAT = concatFn;
        (alasql as any).fn.concat = concatFn;
      }
      
      // Test the function registration by trying simple queries
      try {
        const testResult = alasql("SELECT DATEDIFF('2026-01-14', '2026-01-13') AS diff");
        console.log('✅ DATEDIFF function test successful:', testResult);
      } catch (testError: any) {
        console.warn('⚠️ DATEDIFF function test failed:', testError.message);
        console.log('💡 Function registered but may need different syntax or alasql version');
      }
      
      try {
        const testStrCmpResult = alasql("SELECT STRCMP('abc', 'def') AS cmp");
        console.log('✅ STRCMP function test successful:', testStrCmpResult);
      } catch (testError: any) {
        console.warn('⚠️ STRCMP function test failed:', testError.message);
        console.log('💡 Function registered but may need different syntax or alasql version');
      }
      
      // Helper function to initialize Exercise 3 data
      const initializeExercise3Data = () => {
        // Clear any existing data
        alasql('DROP TABLE IF EXISTS Students');
        alasql('DROP TABLE IF EXISTS Courses');
        alasql('DROP TABLE IF EXISTS Lecturers');
        alasql('DROP TABLE IF EXISTS Enrollments');
        
        // Create tables and insert data
        alasql(`
          CREATE TABLE Students (
            StudentID TEXT PRIMARY KEY,
            FirstName TEXT,
            LastName TEXT,
            BirthDate TEXT,
            City TEXT,
            Email TEXT
          );
        `);
        
        alasql(`
          CREATE TABLE Courses (
            CourseID INTEGER PRIMARY KEY,
            CourseName TEXT,
            Credits INTEGER,
            Department TEXT
          );
        `);
        
        alasql(`
          CREATE TABLE Lecturers (
            LecturerID TEXT PRIMARY KEY,
            FirstName TEXT,
            LastName TEXT,
            City TEXT,
            HireDate TEXT,
            CourseID INTEGER,
            Seniority TEXT
          );
        `);
        
        alasql(`
          CREATE TABLE Enrollments (
            StudentID TEXT,
            CourseID INTEGER,
            EnrollmentDate TEXT,
            Grade INTEGER,
            PRIMARY KEY (StudentID, CourseID)
          );
        `);
        
        // Insert Students data
        alasql(`
          INSERT INTO Students VALUES
            ('87369214', 'John', 'Doe', '1999-05-15', 'Tel Aviv', 'john.doe@gmail.com'),
            ('194DEF23', 'Jane', 'Smith', '2000-07-22', 'Haifa', 'jane.smith@gmail.com'),
            ('38741562', 'Michael', 'Brown', '1998-12-01', 'Jerusalem', 'michael.brown@gmail.com'),
            ('95718234', 'Emily', 'Davis', '2001-03-14', 'Beer Sheva', 'emily.davis@gmail.com'),
            ('21394GHI', 'Daniel', 'Wilson', '1997-11-09', 'Herzliya', 'daniel.wilson@gmail.com'),
            ('48273916', 'Sarah', 'Thompson', '2002-06-18', 'Petah Tikva', 'sarah.thompson@gmail.com'),
            ('63918472', 'Robert', 'Johnson', '1999-08-21', 'Ramat Gan', 'robert.johnson@gmail.com'),
            ('75193486', 'Laura', 'Martinez', '2000-04-12', 'Netanya', 'laura.martinez@gmail.com'),
            ('28471639', 'James', 'Taylor', '2001-09-25', 'Tel Aviv', 'james.taylor@gmail.com'),
            ('56782941', 'Olivia', 'White', '2000-02-14', 'Haifa', 'olivia.white@gmail.com'),
            ('39284756', 'William', 'Harris', '1999-11-08', 'Jerusalem', 'william.harris@gmail.com'),
            ('64829173', 'Sophia', 'Martin', '2002-04-30', 'Beer Sheva', 'sophia.martin@gmail.com'),
            ('71938462', 'Benjamin', 'Garcia', '1998-07-19', 'Herzliya', 'benjamin.garcia@gmail.com'),
            ('83572914', 'Isabella', 'Rodriguez', '2001-12-03', 'Petah Tikva', 'isabella.rodriguez@gmail.com'),
            ('46281937', 'Lucas', 'Lewis', '2000-05-27', 'Ramat Gan', 'lucas.lewis@gmail.com'),
            ('92738461', 'Mia', 'Walker', '1999-10-11', 'Netanya', 'mia.walker@gmail.com'),
            ('18374629', 'Henry', 'Hall', '2002-01-22', 'Tel Aviv', 'henry.hall@gmail.com'),
            ('74938216', 'Charlotte', 'Allen', '2001-08-05', 'Haifa', 'charlotte.allen@gmail.com'),
            ('52839174', 'Alexander', 'Young', '1998-03-16', 'Jerusalem', 'alexander.young@gmail.com'),
            ('69482735', 'Amelia', 'King', '2000-06-28', 'Beer Sheva', 'amelia.king@gmail.com'),
            ('37192846', 'Mason', 'Wright', '1999-12-09', 'Herzliya', 'mason.wright@gmail.com'),
            ('85629374', 'Harper', 'Lopez', '2002-02-20', 'Petah Tikva', 'harper.lopez@gmail.com'),
            ('42918376', 'Ethan', 'Hill', '2001-09-13', 'Ramat Gan', 'ethan.hill@gmail.com'),
            ('71829463', 'Evelyn', 'Scott', '2000-04-25', 'Netanya', 'evelyn.scott@gmail.com'),
            ('56372819', 'Aiden', 'Green', '1998-11-07', 'Tel Aviv', 'aiden.green@gmail.com'),
            ('84729163', 'Abigail', 'Adams', '2001-07-19', 'Haifa', 'abigail.adams@gmail.com'),
            ('39281746', 'Noah', 'Baker', '1999-01-31', 'Jerusalem', 'noah.baker@gmail.com'),
            ('62839471', 'Elizabeth', 'Nelson', '2002-05-14', 'Beer Sheva', 'elizabeth.nelson@gmail.com'),
            ('17483926', 'Liam', 'Carter', '2000-10-26', 'Herzliya', 'liam.carter@gmail.com'),
            ('73928461', 'Sofia', 'Mitchell', '1998-08-08', 'Petah Tikva', 'sofia.mitchell@gmail.com'),
            ('48572913', 'Logan', 'Perez', '2001-03-21', 'Ramat Gan', 'logan.perez@gmail.com'),
            ('61938472', 'Avery', 'Roberts', '2000-12-04', 'Netanya', 'avery.roberts@gmail.com'),
            ('82739164', 'Jackson', 'Turner', '1999-06-17', 'Tel Aviv', 'jackson.turner@gmail.com'),
            ('39482715', 'Ella', 'Phillips', '2002-09-29', 'Haifa', 'ella.phillips@gmail.com'),
            ('72839461', 'Levi', 'Campbell', '2001-02-11', 'Jerusalem', 'levi.campbell@gmail.com'),
            ('56381947', 'Scarlett', 'Parker', '2000-08-23', 'Beer Sheva', 'scarlett.parker@gmail.com'),
            ('81937462', 'Sebastian', 'Evans', '1998-04-06', 'Herzliya', 'sebastian.evans@gmail.com'),
            ('47283916', 'Victoria', 'Edwards', '2001-11-18', 'Petah Tikva', 'victoria.edwards@gmail.com'),
            ('63829174', 'Jack', 'Collins', '2000-05-01', 'Ramat Gan', 'jack.collins@gmail.com'),
            ('72938416', 'Aria', 'Stewart', '1999-01-13', 'Netanya', 'aria.stewart@gmail.com'),
            ('38472961', 'Owen', 'Sanchez', '2002-07-25', 'Tel Aviv', 'owen.sanchez@gmail.com'),
            ('59183746', 'Grace', 'Morris', '2001-10-07', 'Haifa', 'grace.morris@gmail.com');
        `);
        
        // Insert Courses data
        alasql(`
          INSERT INTO Courses VALUES
            (101, 'Introduction to CS', 4, 'Computer Science'),
            (102, 'Organic Chemistry', 3, 'Chemistry'),
            (103, 'Modern Physics', 4, 'Chemistry'),
            (104, 'Calculus I', 3, 'Mathematics'),
            (105, 'General Biology', 5, 'Biology'),
            (106, 'Database', 4, 'Computer Science'),
            (107, 'Statistics', 3, 'Mathematics'),
            (108, 'Data Structures', 4, 'Computer Science'),
            (109, 'Algorithms', 4, 'Computer Science'),
            (110, 'Software Engineering', 5, 'Computer Science'),
            (111, 'Linear Algebra', 3, 'Mathematics'),
            (112, 'Calculus II', 3, 'Mathematics'),
            (113, 'Discrete Mathematics', 4, 'Mathematics'),
            (114, 'Inorganic Chemistry', 3, 'Chemistry'),
            (115, 'Biochemistry', 4, 'Chemistry'),
            (116, 'Cell Biology', 4, 'Biology'),
            (117, 'Genetics', 5, 'Biology'),
            (118, 'Ecology', 3, 'Biology'),
            (119, 'Probability Theory', 3, 'Mathematics'),
            (120, 'Machine Learning', 5, 'Computer Science'),
            (121, 'Web Development', 4, 'Computer Science'),
            (122, 'Operating Systems', 4, 'Computer Science');
        `);
        
        // Insert Lecturers data
        alasql(`
          INSERT INTO Lecturers VALUES
            ('ABC95716', 'Alice', 'Johnson', 'Tel Aviv', '2010-08-15', 101, '14'),
            ('74819253', 'Bob', 'Lee', 'Haifa', '2015-01-30', 106, 'D'),
            ('91738254', 'Carol', 'Miller', 'Jerusalem', '2012-09-22', 103, '12'),
            ('28194675', 'David', 'Anderson', 'Ramat Gan', '2008-03-10', 104, '16'),
            ('62719384', 'Eve', 'Clark', 'Netanya', '2011-11-05', 105, '13'),
            ('34982715', 'Frank', 'Harris', 'Beer Sheva', '2009-06-18', 102, '15'),
            ('48273916', 'George', 'Moore', 'Tel Aviv', '2013-04-20', 108, '11'),
            ('63918472', 'Helen', 'Taylor', 'Haifa', '2014-07-12', 109, '10'),
            ('75193486', 'Ian', 'Wilson', 'Jerusalem', '2016-02-28', 110, '8'),
            ('28471639', 'Julia', 'Brown', 'Ramat Gan', '2011-09-05', 111, '13'),
            ('56782941', 'Kevin', 'Davis', 'Netanya', '2012-11-18', 112, '12'),
            ('39284756', 'Linda', 'Miller', 'Beer Sheva', '2015-05-22', 113, '9'),
            ('64829173', 'Mark', 'Garcia', 'Tel Aviv', '2009-03-14', 114, '15'),
            ('71938462', 'Nancy', 'Rodriguez', 'Haifa', '2010-10-30', 115, '14'),
            ('83572914', 'Oliver', 'Martinez', 'Jerusalem', '2014-01-08', 116, '10'),
            ('46281937', 'Patricia', 'Lopez', 'Ramat Gan', '2013-06-25', 117, '11'),
            ('92738461', 'Quinn', 'Gonzalez', 'Netanya', '2016-08-17', 118, '8'),
            ('18374629', 'Rachel', 'Hernandez', 'Beer Sheva', '2011-12-03', 119, '13'),
            ('74938216', 'Samuel', 'Smith', 'Tel Aviv', '2012-04-19', 120, '12'),
            ('52839174', 'Tina', 'Johnson', 'Haifa', '2015-09-11', 121, '9'),
            ('69482735', 'Victor', 'Williams', 'Jerusalem', '2014-11-26', 122, '10');
        `);
        
        // Insert Enrollments data
        alasql(`
          INSERT INTO Enrollments VALUES
            ('87369214', 101, '2023-09-01', 92),
            ('87369214', 104, '2023-09-01', 76),
            ('87369214', 106, '2024-06-10', 61),
            ('87369214', 108, '2023-09-15', 88),
            ('87369214', 120, '2024-01-10', 85),
            ('194DEF23', 102, '2023-09-02', 78),
            ('194DEF23', 106, '2024-07-05', 83),
            ('194DEF23', 114, '2023-09-20', 75),
            ('194DEF23', 115, '2024-02-05', 82),
            ('38741562', 104, '2023-09-03', 95),
            ('38741562', 111, '2023-09-10', 91),
            ('38741562', 112, '2024-01-15', 89),
            ('38741562', 113, '2024-02-20', 87),
            ('95718234', 103, '2024-06-20', 82),
            ('95718234', 106, '2024-07-01', 90),
            ('95718234', 108, '2023-09-12', 79),
            ('95718234', 109, '2024-01-08', 84),
            ('21394GHI', 102, '2023-09-05', 74),
            ('21394GHI', 114, '2023-09-18', 68),
            ('21394GHI', 115, '2024-02-12', 72),
            ('48273916', 101, '2023-09-01', 96),
            ('48273916', 104, '2023-09-05', 88),
            ('48273916', 108, '2023-09-20', 92),
            ('48273916', 109, '2024-01-10', 90),
            ('48273916', 120, '2024-02-15', 87),
            ('63918472', 103, '2024-07-15', 67),
            ('63918472', 114, '2023-09-15', 71),
            ('63918472', 115, '2024-02-08', 65),
            ('75193486', 101, '2023-09-01', 98),
            ('75193486', 106, '2024-06-12', 94),
            ('75193486', 108, '2023-09-18', 96),
            ('75193486', 109, '2024-01-12', 95),
            ('75193486', 110, '2024-02-20', 93),
            ('28471639', 101, '2023-09-02', 85),
            ('28471639', 104, '2023-09-06', 78),
            ('28471639', 106, '2024-06-15', 81),
            ('28471639', 108, '2023-09-22', 83),
            ('56782941', 102, '2023-09-03', 80),
            ('56782941', 114, '2023-09-22', 76),
            ('56782941', 115, '2024-02-10', 79),
            ('39284756', 103, '2024-06-22', 88),
            ('39284756', 114, '2023-09-25', 82),
            ('39284756', 115, '2024-02-15', 85),
            ('64829173', 105, '2023-09-08', 90),
            ('64829173', 116, '2023-09-28', 87),
            ('64829173', 117, '2024-01-18', 89),
            ('64829173', 118, '2024-02-25', 86),
            ('71938462', 105, '2023-09-10', 92),
            ('71938462', 116, '2023-10-02', 88),
            ('71938462', 117, '2024-01-20', 91),
            ('83572914', 104, '2023-09-04', 94),
            ('83572914', 111, '2023-09-12', 90),
            ('83572914', 112, '2024-01-18', 92),
            ('83572914', 113, '2024-02-22', 89),
            ('46281937', 105, '2023-09-12', 86),
            ('46281937', 116, '2023-10-05', 83),
            ('46281937', 117, '2024-01-22', 85),
            ('92738461', 101, '2023-09-03', 91),
            ('92738461', 106, '2024-06-18', 88),
            ('92738461', 108, '2023-09-25', 89),
            ('92738461', 121, '2024-01-15', 87),
            ('18374629', 104, '2023-09-07', 82),
            ('18374629', 111, '2023-09-15', 79),
            ('18374629', 112, '2024-01-20', 81),
            ('18374629', 119, '2024-02-28', 77),
            ('74938216', 102, '2023-09-06', 75),
            ('74938216', 114, '2023-09-28', 72),
            ('52839174', 103, '2024-06-25', 84),
            ('52839174', 115, '2024-02-18', 80),
            ('69482735', 105, '2023-09-14', 88),
            ('69482735', 116, '2023-10-08', 85),
            ('69482735', 118, '2024-03-02', 82),
            ('37192846', 101, '2023-09-04', 89),
            ('37192846', 108, '2023-09-28', 86),
            ('37192846', 109, '2024-01-18', 88),
            ('37192846', 120, '2024-02-22', 85),
            ('85629374', 106, '2024-06-20', 91),
            ('85629374', 108, '2023-10-02', 88),
            ('85629374', 110, '2024-02-25', 90),
            ('85629374', 121, '2024-01-20', 87),
            ('42918376', 104, '2023-09-08', 93),
            ('42918376', 111, '2023-09-18', 90),
            ('42918376', 112, '2024-01-22', 92),
            ('42918376', 113, '2024-03-05', 89),
            ('71829463', 102, '2023-09-07', 77),
            ('71829463', 114, '2023-10-05', 74),
            ('56372819', 101, '2023-09-05', 87),
            ('56372819', 108, '2023-10-08', 84),
            ('56372819', 109, '2024-01-22', 86),
            ('56372819', 122, '2024-02-28', 83),
            ('84729163', 103, '2024-06-28', 86),
            ('84729163', 115, '2024-02-20', 82),
            ('39281746', 105, '2023-09-16', 91),
            ('39281746', 116, '2023-10-10', 88),
            ('39281746', 117, '2024-01-25', 90),
            ('62839471', 104, '2023-09-09', 96),
            ('62839471', 111, '2023-09-20', 93),
            ('62839471', 112, '2024-01-25', 95),
            ('62839471', 119, '2024-03-08', 92),
            ('17483926', 106, '2024-06-22', 89),
            ('17483926', 110, '2024-02-28', 87),
            ('17483926', 121, '2024-01-22', 85),
            ('73928461', 101, '2023-09-06', 90),
            ('73928461', 108, '2023-10-10', 87),
            ('73928461', 120, '2024-03-02', 88),
            ('48572913', 102, '2023-09-08', 79),
            ('48572913', 114, '2023-10-12', 76),
            ('61938472', 103, '2024-07-01', 83),
            ('61938472', 115, '2024-02-22', 79),
            ('82739164', 105, '2023-09-18', 89),
            ('82739164', 116, '2023-10-15', 86),
            ('82739164', 118, '2024-03-05', 84),
            ('39482715', 104, '2023-09-10', 97),
            ('39482715', 111, '2023-09-22', 94),
            ('39482715', 112, '2024-01-28', 96),
            ('72839461', 106, '2024-06-25', 92),
            ('72839461', 109, '2024-01-25', 90),
            ('72839461', 110, '2024-03-08', 88),
            ('56381947', 101, '2023-09-07', 88),
            ('56381947', 108, '2023-10-12', 85),
            ('56381947', 109, '2024-01-28', 87),
            ('81937462', 102, '2023-09-09', 81),
            ('81937462', 114, '2023-10-15', 78),
            ('47283916', 103, '2024-07-03', 85),
            ('47283916', 115, '2024-02-25', 81),
            ('63829174', 105, '2023-09-20', 90),
            ('63829174', 116, '2023-10-18', 87),
            ('63829174', 117, '2024-01-30', 89),
            ('72938416', 104, '2023-09-11', 95),
            ('72938416', 111, '2023-09-25', 92),
            ('72938416', 112, '2024-02-02', 94),
            ('38472961', 106, '2024-06-28', 93),
            ('38472961', 110, '2024-03-10', 91),
            ('38472961', 121, '2024-01-28', 89),
            ('59183746', 101, '2023-09-08', 86),
            ('59183746', 108, '2023-10-15', 83),
            ('59183746', 122, '2024-03-05', 80);
        `);
      };

      // Helper function to initialize Exam Prep (הכנה למבחן) data
      const initializeExamPrepData = () => {
        alasql('DROP TABLE IF EXISTS Scores');
        alasql('DROP TABLE IF EXISTS Registrations');
        alasql('DROP TABLE IF EXISTS Exams');
        alasql('DROP TABLE IF EXISTS Students');

        alasql(`
          CREATE TABLE Exams (
            ExamID INTEGER PRIMARY KEY,
            CourseCode TEXT,
            ExamDate TEXT,
            DurationMinutes INTEGER,
            Room TEXT
          );
        `);
        alasql(`
          CREATE TABLE Students (
            StudentID INTEGER PRIMARY KEY,
            FirstName TEXT,
            LastName TEXT,
            Major TEXT,
            Year INTEGER
          );
        `);
        alasql(`
          CREATE TABLE Registrations (
            RegistrationID INTEGER PRIMARY KEY,
            StudentID INTEGER,
            ExamID INTEGER,
            RegisteredAt TEXT,
            Status TEXT
          );
        `);
        alasql(`
          CREATE TABLE Scores (
            StudentID INTEGER,
            ExamID INTEGER,
            Score INTEGER,
            GradedAt TEXT,
            FirstExamDate TEXT,
            PRIMARY KEY (StudentID, ExamID)
          );
        `);

        // Exams: mix of near-future (for Q1), room A1, duration > 120
        alasql(`
          INSERT INTO Exams VALUES
            (1, 'SQL101', '2026-02-15', 90, 'A1'),
            (2, 'DB202', '2026-02-18', 120, 'B2'),
            (3, 'SQL101', '2026-02-22', 150, 'A1'),
            (4, 'DB202', '2026-02-25', 90, 'C3'),
            (5, 'SQL201', '2026-03-01', 135, 'A1'),
            (6, 'DB301', '2026-03-05', 105, 'B1'),
            (7, 'BI101', '2026-03-08', 80, 'D2'),
            (8, 'ST201', '2026-03-11', 140, 'A1'),
            (9, 'CS330', '2026-03-14', 110, 'C1'),
            (10, 'MATH220', '2026-03-18', 100, 'B3'),
            (11, 'SQL301', '2026-03-21', 160, 'A2'),
            (12, 'DB150', '2026-03-24', 95, 'A1');
        `);
        // Students: some with no registrations (Q2), multiple exams (Q5) - FirstName/LastName in English
        alasql(`
          INSERT INTO Students VALUES
            (1001, 'Eli', 'Cohen', 'CS', 2),
            (1002, 'Maya', 'Levy', 'Math', 2),
            (1003, 'David', 'Israeli', 'CS', 3),
            (1004, 'Sarah', 'Mizrahi', 'Math', 2),
            (1005, 'Yossi', 'Avraham', 'CS', 3),
            (1006, 'Ronit', 'Dahan', 'Math', 1),
            (1007, 'Amit', 'Ben-David', 'CS', 2),
            (1008, 'Noa', 'Shimon', 'Biology', 1),
            (1009, 'Tom', 'Gal', 'CS', 4),
            (1010, 'Hila', 'Adari', 'Math', 3),
            (1011, 'Ron', 'Saadon', 'CS', 2),
            (1012, 'Lior', 'Katz', 'Math', 2),
            (1013, 'Shir', 'Alon', 'Biology', 3),
            (1014, 'Aviv', 'Maman', 'Statistics', 1),
            (1015, 'Tamar', 'Gold', 'CS', 4),
            (1016, 'Yonatan', 'Shagav', 'Math', 3),
            (1017, 'Itai', 'Rafaeli', 'CS', 2),
            (1018, 'Dana', 'Avital', 'Math', 2),
            (1019, 'Maya', 'Peri', 'Biology', 1),
            (1020, 'Adam', 'Navon', 'CS', 1);
        `);
        // Registrations: approved, waitlist; some without scores (Q9)
        alasql(`
          INSERT INTO Registrations VALUES
            (1, 1001, 1, '2026-01-10', 'approved'),
            (2, 1001, 2, '2026-01-12', 'approved'),
            (3, 1001, 5, '2026-01-18', 'approved'),
            (4, 1002, 1, '2026-01-11', 'approved'),
            (5, 1002, 3, '2026-01-14', 'waitlist'),
            (6, 1002, 7, '2026-01-19', 'approved'),
            (7, 1003, 1, '2026-01-09', 'approved'),
            (8, 1003, 2, '2026-01-13', 'approved'),
            (9, 1003, 3, '2026-01-15', 'approved'),
            (10, 1003, 8, '2026-01-20', 'approved'),
            (11, 1004, 2, '2026-01-11', 'approved'),
            (12, 1004, 4, '2026-01-16', 'waitlist'),
            (13, 1004, 10, '2026-01-24', 'approved'),
            (14, 1005, 1, '2026-01-10', 'approved'),
            (15, 1005, 3, '2026-01-14', 'approved'),
            (16, 1005, 9, '2026-01-23', 'approved'),
            (17, 1006, 2, '2026-01-12', 'waitlist'),
            (18, 1006, 6, '2026-01-20', 'approved'),
            (19, 1007, 1, '2026-01-15', 'approved'),
            (20, 1007, 2, '2026-01-16', 'approved'),
            (21, 1007, 11, '2026-01-27', 'approved'),
            (22, 1008, 4, '2026-01-17', 'approved'),
            (23, 1008, 7, '2026-01-21', 'approved'),
            (24, 1009, 5, '2026-01-19', 'approved'),
            (25, 1009, 8, '2026-01-21', 'approved'),
            (26, 1009, 12, '2026-01-30', 'approved'),
            (27, 1010, 6, '2026-01-20', 'approved'),
            (28, 1010, 10, '2026-01-24', 'waitlist'),
            (29, 1011, 3, '2026-01-18', 'approved'),
            (30, 1011, 5, '2026-01-22', 'approved'),
            (31, 1012, 1, '2026-01-14', 'approved'),
            (32, 1012, 2, '2026-01-18', 'approved'),
            (33, 1012, 9, '2026-01-25', 'approved'),
            (34, 1013, 4, '2026-01-20', 'approved'),
            (35, 1013, 6, '2026-01-23', 'approved'),
            (36, 1014, 7, '2026-01-22', 'waitlist'),
            (37, 1014, 8, '2026-01-26', 'approved'),
            (38, 1015, 10, '2026-01-27', 'approved'),
            (39, 1015, 12, '2026-01-31', 'approved'),
            (40, 1016, 11, '2026-01-29', 'approved'),
            (41, 1017, 5, '2026-01-28', 'approved'),
            (42, 1018, 6, '2026-01-27', 'approved');
        `);
        // Scores: some registrations without score yet (Q9). No ScoreID; FirstExamDate stores the first exam date for each score entry.
        alasql(`
          INSERT INTO Scores VALUES
            (1001, 1, 85, '2026-02-16', '2026-02-15'),
            (1001, 2, 90, '2026-02-19', '2026-02-18'),
            (1001, 5, 88, '2026-03-02', '2026-03-01'),
            (1002, 1, 78, '2026-02-16', '2026-02-15'),
            (1002, 7, 81, '2026-03-09', '2026-03-08'),
            (1003, 1, 92, '2026-02-16', '2026-02-15'),
            (1003, 2, 88, '2026-02-19', '2026-02-18'),
            (1003, 3, 95, '2026-02-23', '2026-02-22'),
            (1003, 8, 89, '2026-03-12', '2026-03-11'),
            (1004, 2, 72, '2026-02-19', '2026-02-18'),
            (1004, 10, 84, '2026-03-19', '2026-03-18'),
            (1005, 1, 80, '2026-02-16', '2026-02-15'),
            (1005, 3, 84, '2026-02-23', '2026-02-22'),
            (1005, 9, 86, '2026-03-15', '2026-03-14'),
            (1006, 6, 76, '2026-03-06', '2026-03-05'),
            (1007, 1, 91, '2026-02-16', '2026-02-15'),
            (1007, 2, 87, '2026-02-19', '2026-02-18'),
            (1007, 11, 90, '2026-03-22', '2026-03-21'),
            (1008, 4, 75, '2026-02-26', '2026-02-25'),
            (1008, 7, 79, '2026-03-09', '2026-03-08'),
            (1009, 5, 89, '2026-03-02', '2026-03-01'),
            (1009, 8, 86, '2026-03-12', '2026-03-11'),
            (1009, 12, 91, '2026-03-25', '2026-03-24'),
            (1010, 6, 82, '2026-03-06', '2026-03-05'),
            (1011, 3, 88, '2026-02-23', '2026-02-22'),
            (1011, 5, 90, '2026-03-02', '2026-03-01'),
            (1012, 1, 83, '2026-02-16', '2026-02-15'),
            (1012, 2, 81, '2026-02-19', '2026-02-18'),
            (1012, 9, 85, '2026-03-15', '2026-03-14'),
            (1013, 4, 77, '2026-02-26', '2026-02-25'),
            (1013, 6, 80, '2026-03-06', '2026-03-05'),
            (1014, 8, 74, '2026-03-12', '2026-03-11'),
            (1015, 10, 92, '2026-03-19', '2026-03-18'),
            (1015, 12, 93, '2026-03-25', '2026-03-24'),
            (1016, 11, 87, '2026-03-22', '2026-03-21');
        `);
      };

      // Initialize data based on dataset
      const isExamPrep = dataset.connectionUri.includes('exam-prep') ||
                        dataset.name?.includes('הכנה למבחן') ||
                        dataset.name?.includes('מבחנים');
      const isExercise3 = dataset.connectionUri.includes('exercise3-college') ||
                          dataset.name?.includes('תרגיל 3') ||
                          dataset.name?.includes('מכללה');

      if (isExamPrep) {
        initializeExamPrepData();
        console.log('✅ Initialized Exam Prep (הכנה למבחן) tables with sample data using alasql');
      } else if (isExercise3) {
        // Get or assign student-specific table data
        const studentTableData = await this.getOrAssignStudentTableData(
          payload.studentId,
          payload.setId
        );
        
        // Initialize only student's assigned data
        const { initializeStudentSpecificData } = await import('./student-data-assignment');
        initializeStudentSpecificData(alasql, studentTableData);
        console.log('✅ Initialized Exercise 3 tables with student-specific data using alasql');
      } else {
        // Default: Create Employees table
        alasql('DROP TABLE IF EXISTS Employees');
        alasql(`
          CREATE TABLE Employees (
            id INTEGER,
            name TEXT,
            department TEXT,
            salary REAL,
            hire_date TEXT
          );
        `);
        alasql(`
          INSERT INTO Employees VALUES
            (1, 'Alice Johnson', 'Engineering', 95000, '2020-01-15'),
            (2, 'Bob Smith', 'Marketing', 75000, '2019-03-22'),
            (3, 'Carol White', 'Engineering', 98000, '2018-07-10'),
            (4, 'David Brown', 'Sales', 68000, '2021-05-30'),
            (5, 'Eve Davis', 'HR', 72000, '2020-11-12');
        `);
        console.log('✅ Created sample Employees table using alasql');
      }
      
      // Transform SQL to replace MySQL-specific functions with alasql-compatible versions
      const transformMySQLFunctions = (sql: string): string => {
        let transformedSql = sql;
        // Remove semicolon before closing paren (e.g. "from t;);" or "from t;\n);" -> "from t );" so parser accepts it)
        transformedSql = transformedSql.replace(/\s*;\s*\)/g, ' )');
        // Normalize strcmp to STRCMP so lowercase/any case works (engine expects STRCMP)
        transformedSql = transformedSql.replace(/\bstrcmp\s*\(/gi, 'STRCMP(');

        // Get current date in YYYY-MM-DD format for CURDATE() replacement
        const currentDate = new Date().toISOString().split('T')[0];

        // Replace CURDATE() with current date string (MUST be done first, before DATEDIFF transformation)
        // MySQL CURDATE() returns current date
        transformedSql = transformedSql.replace(/\bCURDATE\s*\(\s*\)/gi, `'${currentDate}'`);
        
        // Replace NOW() with current date string (if used)
        transformedSql = transformedSql.replace(/\bNOW\s*\(\s*\)/gi, `'${currentDate}'`);
        
        // Handle date arithmetic like CURDATE()-5 or '2026-01-08'-5 (convert to actual date)
        // This must be done after CURDATE() replacement but before DATEDIFF transformation
        const dateArithmeticRegex = /('[\d-]+')\s*([+\-])\s*(\d+)/g;
        transformedSql = transformedSql.replace(dateArithmeticRegex, (match, dateStr, operator, days) => {
          const dateOnly = dateStr.slice(1, -1); // Remove quotes
          const numDays = parseInt(days, 10);
          const baseDate = new Date(dateOnly);
          if (isNaN(baseDate.getTime())) {
            return match; // Return original if date is invalid
          }
          if (operator === '-') {
            baseDate.setDate(baseDate.getDate() - numDays);
          } else {
            baseDate.setDate(baseDate.getDate() + numDays);
          }
          const calculatedDate = baseDate.toISOString().split('T')[0];
          return `'${calculatedDate}'`;
        });
        
        // Replace DATEDIFF(date1, date2) with calculated values
        // Strategy: 
        // 1. For literal dates (both quoted), calculate directly and replace with number
        // 2. For column references, we'll handle them after query execution by post-processing results
        const datediffRegex = /\b(DATEDIFF|datediff)\s*\(\s*([^,()]+(?:\([^)]*\)[^,()]*)*)\s*,\s*([^)]+)\s*\)/gi;
        transformedSql = transformedSql.replace(datediffRegex, (match, funcName, date1, date2) => {
          const cleanDate1 = date1.trim();
          const cleanDate2 = date2.trim();
          
          // Check if both are quoted strings (literal dates)
          const isDate1Literal = (cleanDate1.startsWith("'") && cleanDate1.endsWith("'")) || 
                                 (cleanDate1.startsWith('"') && cleanDate1.endsWith('"'));
          const isDate2Literal = (cleanDate2.startsWith("'") && cleanDate2.endsWith("'")) || 
                                (cleanDate2.startsWith('"') && cleanDate2.endsWith('"'));
          
          // If both are literals, calculate the difference directly
          if (isDate1Literal && isDate2Literal) {
            try {
              const d1Str = cleanDate1.slice(1, -1);
              const d2Str = cleanDate2.slice(1, -1);
              const d1 = new Date(d1Str);
              const d2 = new Date(d2Str);
              if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                const diffDays = Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                return String(diffDays);
              }
            } catch (e) {
              // If date parsing fails, fall through to column reference handling
            }
          }
          
          // For column references, we need a workaround since alasql doesn't support custom functions
          // Strategy: Replace DATEDIFF with a SQL expression that calculates the difference
          // Since dates are stored as strings in YYYY-MM-DD format, we can extract components
          // and calculate: (year1*365 + month1*30 + day1) - (year2*365 + month2*30 + day2)
          // This is approximate but should work for most educational use cases
          // Alasql uses SUBSTR (not SUBSTRING) for string extraction
          // Format: SUBSTR(string, start, length) where start is 1-based
          return `((CAST(SUBSTR(${cleanDate1}, 1, 4) AS NUMBER) * 365 + CAST(SUBSTR(${cleanDate1}, 6, 2) AS NUMBER) * 30 + CAST(SUBSTR(${cleanDate1}, 9, 2) AS NUMBER)) - (CAST(SUBSTR(${cleanDate2}, 1, 4) AS NUMBER) * 365 + CAST(SUBSTR(${cleanDate2}, 6, 2) AS NUMBER) * 30 + CAST(SUBSTR(${cleanDate2}, 9, 2) AS NUMBER)))`;
        });
        
        return transformedSql;
      };
      
      // Normalize SQL query to handle case-insensitivity for column/table names
      const normalizeSQL = (sql: string): string => {
        // First transform MySQL functions
        let normalizedSql = transformMySQLFunctions(sql);
        
        // Define the correct case for all table and column names
        const caseMap: Record<string, string> = {
          // Table names
          'students': 'Students',
          'courses': 'Courses',
          'lecturers': 'Lecturers',
          'enrollments': 'Enrollments',
          'employees': 'Employees',
          'exams': 'Exams',
          'registrations': 'Registrations',
          'scores': 'Scores',
          // Column names - Students
          'studentid': 'StudentID',
          'firstname': 'FirstName',
          'lastname': 'LastName',
          'birthdate': 'BirthDate',
          'city': 'City',
          'email': 'Email',
          'major': 'Major',
          'year': 'Year',
          // Column names - Courses
          'courseid': 'CourseID',
          'coursename': 'CourseName',
          'credits': 'Credits',
          'department': 'Department',
          // Column names - Lecturers
          'lecturerid': 'LecturerID',
          'hiredate': 'HireDate',
          'seniority': 'Seniority',
          // Column names - Enrollments
          'enrollmentdate': 'EnrollmentDate',
          'grade': 'Grade',
          // Column names - Exams (exam prep)
          'examid': 'ExamID',
          'coursecode': 'CourseCode',
          'examdate': 'ExamDate',
          'durationminutes': 'DurationMinutes',
          'room': 'Room',
          // Column names - Registrations (exam prep)
          'registrationid': 'RegistrationID',
          'registeredat': 'RegisteredAt',
          'status': 'Status',
          // Column names - Scores (exam prep)
          'score': 'Score',
          'gradedat': 'GradedAt',
          'firstexamdate': 'FirstExamDate',
          // Column names - Employees (fallback table)
          'id': 'id',
          'name': 'name',
          'salary': 'salary',
          'hire_date': 'hire_date',
        };
        
        // Replace all occurrences (word boundaries to avoid partial matches)
        for (const [lower, correct] of Object.entries(caseMap)) {
          // Use regex with word boundary and case-insensitive flag
          const regex = new RegExp(`\\b${lower}\\b`, 'gi');
          normalizedSql = normalizedSql.replace(regex, correct);
        }
        
        return normalizedSql;
      };
      
      const normalizedSql = normalizeSQL(payload.sql);
      console.log('🔵 Original SQL:', payload.sql);
      console.log('🔵 Normalized SQL:', normalizedSql);
      
      // Execute the SQL query using alasql
      let result: any[] | undefined;
      let columns: string[] = [];
      try {
        result = alasql(normalizedSql);
        console.log('✅ SQL executed successfully, result type:', typeof result, 'length:', Array.isArray(result) ? result.length : 'N/A');
        
        // Check if result is valid
        if (result === undefined || result === null) {
          throw new Error('SQL query returned undefined result');
        }
        
        // If result is an array of objects, extract columns from first row
        if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
          columns = Object.keys(result[0]);
        } else if (Array.isArray(result) && result.length > 0) {
          // If result is array of arrays, we need to handle differently
          // This shouldn't happen with SELECT queries, but handle it
          console.warn('⚠️ Unexpected result format from alasql');
        }
      } catch (sqlError: any) {
        const executionMs = Date.now() - startTime;
        console.error('❌ SQL execution error:', sqlError.message);
        
        // If VALUE() doesn't work, try a fallback with direct JavaScript expression
        if (sqlError.message.includes('VALUE') || sqlError.message.includes('DATEDIFF') || sqlError.message.includes('datediff') || sqlError.message.includes('STRCMP') || sqlError.message.includes('strcmp') || sqlError.message.includes('Parse error')) {
          const hasStrCmp = sqlError.message.includes('STRCMP') || sqlError.message.includes('strcmp');
          const hasDateDiff = sqlError.message.includes('DATEDIFF') || sqlError.message.includes('datediff');
          console.log('🔄 Attempting fallback: replacing SQL functions with direct JavaScript calculations');
          
          let fallbackSql = payload.sql;
          // Remove semicolon before closing paren (same as main path)
          fallbackSql = fallbackSql.replace(/\s*;\s*\)/g, ' )');
          const currentDate = new Date().toISOString().split('T')[0];
          fallbackSql = fallbackSql.replace(/\bCURDATE\s*\(\s*\)/gi, `'${currentDate}'`);
          fallbackSql = fallbackSql.replace(/\bNOW\s*\(\s*\)/gi, `'${currentDate}'`);
          
          // Replace DATEDIFF with direct calculation - use a simpler approach that alasql can handle
          // Replace VALUE('DATEDIFF', ...) calls first if they exist
          fallbackSql = fallbackSql.replace(/VALUE\s*\(\s*['"]DATEDIFF['"]\s*,\s*([^,()]+)\s*,\s*([^)]+)\s*\)/gi, (match, date1, date2) => {
            const cleanDate1 = date1.trim();
            const cleanDate2 = date2.trim();
            return `(Math.floor((new Date(${cleanDate1}).getTime() - new Date(${cleanDate2}).getTime()) / (1000 * 60 * 60 * 24)))`;
          });
          
          // Also replace direct DATEDIFF calls
          const datediffRegex = /\b(DATEDIFF|datediff)\s*\(\s*([^,()]+(?:\([^)]*\)[^,()]*)*)\s*,\s*([^)]+)\s*\)/gi;
          fallbackSql = fallbackSql.replace(datediffRegex, (match, funcName, date1, date2) => {
            const cleanDate1 = date1.trim();
            const cleanDate2 = date2.trim();
            // Use direct JavaScript calculation
            return `(Math.floor((new Date(${cleanDate1}).getTime() - new Date(${cleanDate2}).getTime()) / (1000 * 60 * 60 * 24)))`;
          });
          
          // Replace STRCMP with JavaScript string comparison
          // STRCMP(str1, str2) returns -1 if str1 < str2, 0 if equal, 1 if str1 > str2
          const strcmpRegex = /\b(STRCMP|strcmp)\s*\(\s*([^,()]+(?:\([^)]*\)[^,()]*)*)\s*,\s*([^)]+)\s*\)/gi;
          fallbackSql = fallbackSql.replace(strcmpRegex, (match, funcName, str1, str2) => {
            const cleanStr1 = str1.trim();
            const cleanStr2 = str2.trim();
            // Create a JavaScript expression that compares strings
            // Use ternary operators to return -1, 0, or 1
            return `((${cleanStr1} < ${cleanStr2}) ? -1 : ((${cleanStr1} > ${cleanStr2}) ? 1 : 0))`;
          });
          
          // Normalize case for tables/columns (but skip function transformation to avoid recursion)
          let normalizedFallbackSql = fallbackSql;
          const caseMap: Record<string, string> = {
            'students': 'Students', 'courses': 'Courses', 'lecturers': 'Lecturers', 
            'enrollments': 'Enrollments', 'studentid': 'StudentID', 'firstname': 'FirstName',
            'lastname': 'LastName', 'courseid': 'CourseID', 'enrollmentdate': 'EnrollmentDate'
          };
          for (const [lower, correct] of Object.entries(caseMap)) {
            const regex = new RegExp(`\\b${lower}\\b`, 'gi');
            normalizedFallbackSql = normalizedFallbackSql.replace(regex, correct);
          }
          
          console.log('🔄 Fallback SQL:', normalizedFallbackSql);
          
          try {
            result = alasql(normalizedFallbackSql);
            console.log('✅ Fallback SQL executed successfully');
            // Continue with normal processing below
          } catch (fallbackError: any) {
            console.error('❌ Fallback also failed:', fallbackError.message);
            // Return the error
            const functionName = hasStrCmp ? 'STRCMP' : hasDateDiff ? 'DATEDIFF' : 'SQL function';
            const errorMessage = `SQL Error: ${sqlError.message || 'Invalid SQL syntax'}. ${functionName} function transformation failed.`;
            return {
              columns: [],
              rows: [],
              executionMs,
              truncated: false,
              feedback: {
                questionId: payload.questionId,
                score: 0,
                autoNotes: errorMessage,
                rubricBreakdown: [],
              },
            };
          }
        } else {
          // Other errors - return as is, with friendly hints where applicable
          const errorMessage = sqlError.message || 'Invalid SQL syntax';
          const errLower = errorMessage.toLowerCase();

          // Ambiguous column / "need table prefix": when same column exists in multiple tables
          const isAmbiguous = errLower.includes('ambiguous') || errLower.includes('which one') || errLower.includes('qualify');
          const ambiguousHint = isAmbiguous
            ? ' העמודה מופיעה ביותר מטבלה אחת — השתמשו ב־Table.Column רק כשצריך להבדיל (למשל Students.StudentID).'
            : '';

          // Check if this is a JavaScript runtime error (like "Cannot read properties of undefined")
          const isRuntimeError = errorMessage.includes('Cannot read properties') ||
                                 errorMessage.includes('reading') ||
                                 errorMessage.includes('undefined');

          // Check if the query uses nested subqueries (which alasql may struggle with)
          const hasNestedSubquery = payload.sql.match(/\([^)]*\s+IN\s*\([^)]*\(/i) ||
                                         payload.sql.match(/\([^)]*\s*=\s*\([^)]*\(/i);

          const errorHint = ambiguousHint
            ? ambiguousHint
            : isRuntimeError && hasNestedSubquery
            ? ' This error may occur with deeply nested subqueries. Try rewriting your query using JOINs instead of nested IN subqueries.'
            : isRuntimeError
            ? ' Try simplifying the query or using a different approach (e.g., JOINs instead of subqueries).'
            : '';

          return {
            columns: [],
            rows: [],
            executionMs,
            truncated: false,
            feedback: {
              questionId: payload.questionId,
              score: 0,
              autoNotes: `SQL Error: ${errorMessage}${errorHint ? '\n' + errorHint : ''}`,
              rubricBreakdown: [],
            },
          };
        }
      }
      
      const executionMs = Date.now() - startTime;
      
      // Convert alasql result format to our format
      if (!result || !Array.isArray(result) || result.length === 0) {
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
      
      // Convert array of objects to our format
      // Also post-process DATEDIFF calculations for column references
      const rows = result.map((row: any) => {
        if (typeof row === 'object' && row !== null) {
          // Post-process: Calculate DATEDIFF for any columns that need it
          // This handles cases where DATEDIFF was used with column references
          const processedRow = { ...row };
          
          // Check if any values look like they need DATEDIFF calculation
          // (This is a fallback - ideally we'd track which columns need processing)
          // For now, the transformation should have handled most cases
          
          return processedRow;
        }
        // Handle non-object results (shouldn't happen with SELECT)
        return { value: row };
      });
      
      // Get columns from first row if not already set
      if (columns.length === 0 && rows.length > 0) {
        columns = Object.keys(rows[0]);
      }
      
      // Truncate if too many rows
      const maxRows = 50;
      const truncated = rows.length > maxRows;
      const truncatedRows = truncated ? rows.slice(0, maxRows) : rows;
      
      // Simple scoring based on result
      const score = rows.length > 0 ? 8 : 5;
      
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

export async function submitSubmission(
  homeworkSetId: string,
  studentId: string,
  aiCommitment?: Submission["aiCommitment"],
): Promise<Submission | null> {
  const service = await getSubmissionsService();
  return service.submitSubmission(homeworkSetId, studentId, aiCommitment);
}

export async function gradeSubmission(submissionId: string, updates: Partial<Submission>): Promise<Submission | null> {
  const service = await getSubmissionsService();
  return service.gradeSubmission(submissionId, updates);
}

export async function executeSqlForSubmission(payload: SqlExecutionRequest): Promise<SqlExecutionResponse | null> {
  const service = await getSubmissionsService();
  return service.executeSqlForSubmission(payload);
}

export async function getSubmissionProgress(submissionId: string): Promise<QuestionProgress[] | null> {
  const service = await getSubmissionsService();
  return service.getSubmissionProgress(submissionId);
}
