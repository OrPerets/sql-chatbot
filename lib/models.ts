import { ObjectId } from 'mongodb';
import type {
  Dataset,
  HomeworkSet,
  Question,
  Submission,
  AnalyticsEvent,
  AuditLogEntry,
  QuestionTemplate,
  InstantiatedQuestion
} from '@/app/homework/types';
import type { AnalysisResult } from './ai-analysis';

/**
 * Database model interfaces with MongoDB-specific fields
 */

export interface DatasetModel extends Omit<Dataset, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface HomeworkSetModel extends Omit<HomeworkSet, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface QuestionModel extends Omit<Question, 'id'> {
  _id?: ObjectId;
  id: string;
  homeworkSetId: string; // Reference to parent homework set
}

export interface SubmissionModel extends Omit<Submission, 'id'> {
  _id?: ObjectId;
  id: string;
  studentTableData?: Record<string, any[]>; // Key: table name, Value: array of row data
}

export interface AnalyticsEventModel extends Omit<AnalyticsEvent, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface AuditLogEntryModel extends Omit<AuditLogEntry, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface QuestionTemplateModel extends Omit<QuestionTemplate, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface InstantiatedQuestionModel extends Omit<InstantiatedQuestion, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface AnalysisResultModel extends Omit<AnalysisResult, 'id'> {
  _id?: ObjectId;
  id: string;
}

export interface QuestionAnalyticsModel {
  _id?: ObjectId;
  id?: string;
  submissionId: string;
  questionId: string;
  studentId: string;
  homeworkSetId: string;
  metrics: {
    timeSpent: number;
    typingSpeed: number;
    attempts: number;
    timeToFirstExecution?: number | null;
    timeBetweenExecutions: number[];
    queryExecutionTimes: number[];
    charactersTyped: number;
    editsCount: number;
    copyPasteCount: number;
    startedAt: string;
    lastActivityAt: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Database indexes for optimal query performance
 */
export const DATABASE_INDEXES = {
  DATASETS: [
    { name: 1 }, // For name-based searches
    { tags: 1 }, // For tag-based filtering
    { updatedAt: -1 }, // For sorting by recency
  ],
  HOMEWORK_SETS: [
    { courseId: 1 }, // For course-based filtering
    { visibility: 1 }, // For status filtering
    { createdBy: 1 }, // For instructor filtering
    { dueAt: 1 }, // For due date sorting
    { createdAt: -1 }, // For creation date sorting
    { published: 1, visibility: 1 }, // Compound index for common queries
  ],
  QUESTIONS: [
    { homeworkSetId: 1 }, // For homework set queries
    { homeworkSetId: 1, id: 1 }, // Compound for specific question lookups
  ],
  SUBMISSIONS: [
    { homeworkSetId: 1 }, // For homework set submissions
    { studentId: 1 }, // For student submissions
    { homeworkSetId: 1, studentId: 1 }, // Compound for specific student submission
    { status: 1 }, // For status filtering
    { submittedAt: -1 }, // For submission date sorting
    { gradedAt: -1 }, // For grading date sorting
  ],
  ANALYTICS: [
    { setId: 1 }, // For homework set analytics
    { type: 1 }, // For event type filtering
    { actorId: 1 }, // For user analytics
    { createdAt: -1 }, // For time-based queries
    { setId: 1, type: 1 }, // Compound for specific analytics
  ],
  AUDIT_LOGS: [
    { actorId: 1 }, // For user audit trails
    { targetType: 1 }, // For entity type filtering
    { action: 1 }, // For action type filtering
    { createdAt: -1 }, // For time-based queries
    { targetId: 1 }, // For specific entity audit trails
  ],
  QUESTION_TEMPLATES: [
    { name: 1 }, // For template name searches
    { createdAt: -1 }, // For creation date sorting
    { updatedAt: -1 }, // For update date sorting
    { version: 1 }, // For version tracking
  ],
  INSTANTIATED_QUESTIONS: [
    { templateId: 1 }, // For template-based queries
    { studentId: 1 }, // For student-specific questions
    { homeworkSetId: 1 }, // For homework set queries
    { templateId: 1, studentId: 1 }, // Compound for unique student-template combinations
    { createdAt: -1 }, // For creation date sorting
  ],
  ANALYSIS_RESULTS: [
    { submissionId: 1 }, // For submission-based queries
    { studentId: 1 }, // For student analytics
    { homeworkSetId: 1 }, // For homework set analytics
    { status: 1 }, // For status filtering
    { createdAt: -1 }, // For creation date sorting
    { submissionId: 1, status: 1 }, // Compound for active analyses
  ],
  QUESTION_ANALYTICS: [
    { submissionId: 1 }, // For submission-based analytics lookups
    { questionId: 1 }, // For question-level analysis
    { studentId: 1 }, // For student drilldowns
    { homeworkSetId: 1 }, // For homework set aggregations
  ],
} as const;

/**
 * Validation schemas for database operations
 */
export const VALIDATION_SCHEMAS = {
  DATASET: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    scenario: { type: 'string', maxLength: 1000 },
    story: { type: 'string', maxLength: 2000 },
    connectionUri: { type: 'string', required: true },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 } },
    previewTables: { 
      type: 'array', 
      items: { 
        type: 'object',
        properties: {
          name: { type: 'string', required: true },
          columns: { type: 'array', items: { type: 'string' } }
        }
      }
    },
  },
  HOMEWORK_SET: {
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    courseId: { type: 'string', required: true, minLength: 1, maxLength: 20 },
    dueAt: { type: 'string', required: true }, // ISO date string
    published: { type: 'boolean', required: true },
    datasetPolicy: { type: 'string', enum: ['shared', 'custom'], required: true },
    questionOrder: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    visibility: { type: 'string', enum: ['draft', 'published', 'archived'], required: true },
    createdBy: { type: 'string', required: true },
    overview: { type: 'string', maxLength: 2000 },
    selectedDatasetId: { type: 'string' },
    backgroundStory: { type: 'string', maxLength: 2000 },
  },
  QUESTION: {
    prompt: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    instructions: { type: 'string', required: true, minLength: 1, maxLength: 1000 },
    starterSql: { type: 'string', maxLength: 2000 },
    expectedResultSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          column: { type: 'string', required: true },
          type: { type: 'string', required: true }
        }
      }
    },
    gradingRubric: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          label: { type: 'string', required: true },
          description: { type: 'string', required: true },
          weight: { type: 'number', minimum: 0, maximum: 100 },
          autoGraded: { type: 'boolean', required: true }
        }
      }
    },
    datasetId: { type: 'string' },
    maxAttempts: { type: 'number', minimum: 1, maximum: 10, default: 3 },
    points: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    evaluationMode: { type: 'string', enum: ['auto', 'manual', 'custom'] },
    homeworkSetId: { type: 'string', required: true },
  },
  SUBMISSION: {
    homeworkSetId: { type: 'string', required: true },
    studentId: { type: 'string', required: true },
    attemptNumber: { type: 'number', minimum: 1, default: 1 },
    answers: { type: 'object', required: true }, // Record<string, SqlAnswer>
    overallScore: { type: 'number', minimum: 0, default: 0 },
    status: { type: 'string', enum: ['in_progress', 'submitted', 'graded'], required: true },
    submittedAt: { type: 'string' }, // ISO date string
    gradedAt: { type: 'string' }, // ISO date string
  },
  QUESTION_TEMPLATE: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    template: { type: 'string', required: true, minLength: 1, maxLength: 2000 },
    variables: { type: 'array', items: { type: 'object' } },
    expectedResultSchema: { type: 'array', items: { type: 'object' } },
    starterSql: { type: 'string', maxLength: 2000 },
    instructions: { type: 'string', maxLength: 1000 },
    gradingRubric: { type: 'array', items: { type: 'object' } },
    datasetId: { type: 'string' },
    maxAttempts: { type: 'number', minimum: 1, maximum: 10, default: 3 },
    points: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    evaluationMode: { type: 'string', enum: ['auto', 'manual', 'custom'] },
    version: { type: 'number', minimum: 1, required: true },
  },
  INSTANTIATED_QUESTION: {
    templateId: { type: 'string', required: true },
    studentId: { type: 'string', required: true },
    homeworkSetId: { type: 'string', required: true },
    variables: { type: 'array', items: { type: 'object' } },
    prompt: { type: 'string', required: true, minLength: 1, maxLength: 500 },
    instructions: { type: 'string', required: true, minLength: 1, maxLength: 1000 },
    starterSql: { type: 'string', maxLength: 2000 },
    expectedResultSchema: { type: 'array', items: { type: 'object' } },
    gradingRubric: { type: 'array', items: { type: 'object' } },
    datasetId: { type: 'string' },
    maxAttempts: { type: 'number', minimum: 1, maximum: 10, default: 3 },
    points: { type: 'number', minimum: 1, maximum: 100, default: 10 },
    evaluationMode: { type: 'string', enum: ['auto', 'manual', 'custom'] },
  },
  ANALYSIS_RESULT: {
    submissionId: { type: 'string', required: true },
    studentId: { type: 'string', required: true },
    homeworkSetId: { type: 'string', required: true },
    analysisType: { type: 'string', enum: ['failure_analysis', 'pattern_recognition', 'feedback_generation'], required: true },
    status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'], required: true },
    confidence: { type: 'number', minimum: 0, maximum: 1, required: true },
    results: { type: 'object', required: true },
    metadata: { type: 'object', required: true },
  },
} as const;

/**
 * Utility functions for data transformation
 */
export function toDatabaseModel<T extends { id: string }>(
  item: T
): Omit<T, 'id'> & { _id?: ObjectId } {
  const { id, ...rest } = item;
  return {
    ...rest,
    _id: new ObjectId(id),
  };
}

export function fromDatabaseModel<T extends { _id?: ObjectId }>(
  item: T
): Omit<T, '_id'> & { id: string } {
  const { _id, ...rest } = item;
  return {
    ...rest,
    id: _id?.toString() || '',
  };
}

/**
 * Helper function to generate unique IDs
 */
export function generateId(): string {
  return new ObjectId().toString();
}
