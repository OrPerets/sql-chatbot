import { ObjectId } from 'mongodb';

import { COLLECTIONS, executeWithRetry } from '@/lib/database';

export type LearningQuizTargetType = 'lecture' | 'practice';

export type LearningQuizQuestion = LearningQuizMcqQuestion | LearningQuizSqlQuestion;

export interface LearningQuizMcqQuestion {
  id: string;
  type: 'mcq';
  prompt: string;
  choices: string[];
  correctIndex: number;
  hint?: string;
  explanation?: string;
}

export interface LearningQuizSqlQuestion {
  id: string;
  type: 'sql';
  prompt: string;
  starterSql?: string;
  expectedSql?: string;
  expectedResult?: {
    columns: string[];
    rows: string[][];
  };
  hint?: string;
  explanation?: string;
  runnerConfig?: {
    setId: string;
    questionId: string;
  };
}

export interface LearningQuiz {
  _id?: ObjectId;
  quizId: string;
  targetType: LearningQuizTargetType;
  targetId: string;
  title: string;
  createdBy: 'michael';
  questions: LearningQuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningQuizAnswer {
  questionId: string;
  response: string | number | null;
  correct?: boolean;
}

export interface LearningQuizFeedback {
  questionId: string;
  correct: boolean;
  message: string;
  explanation?: string;
}

export interface LearningQuizResult {
  _id?: ObjectId;
  userId: string;
  quizId: string;
  attemptId: string;
  startedAt: Date;
  completedAt: Date;
  score: number;
  answers: LearningQuizAnswer[];
  feedbackByQuestion: LearningQuizFeedback[];
}

export const normalizeSql = (sql: string) =>
  sql
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\'"]/g, "'")
    .replace(/;/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*>\s*/g, ' > ')
    .replace(/\s*<\s*/g, ' < ')
    .replace(/\s*!=\s*/g, ' != ')
    .replace(/\s*<=\s*/g, ' <= ')
    .replace(/\s*>=\s*/g, ' >= ')
    .replace(/\s*like\s*/gi, ' like ')
    .replace(/\s*is\s+not\s+null\s*/gi, ' is not null ')
    .replace(/\s*is\s+null\s*/gi, ' is null ')
    .replace(/\s*order\s+by\s*/gi, ' order by ')
    .replace(/\s*group\s+by\s*/gi, ' group by ')
    .trim();

export const compareSql = (left: string, right: string) => {
  if (!left || !right) {
    return false;
  }

  return normalizeSql(left) === normalizeSql(right);
};

export async function getLatestLearningQuiz(
  targetType: LearningQuizTargetType,
  targetId: string
): Promise<LearningQuiz | null> {
  return executeWithRetry(async (db) =>
    db
      .collection<LearningQuiz>(COLLECTIONS.LEARNING_QUIZZES)
      .find({ targetType, targetId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next()
  );
}

export async function getLearningQuizById(quizId: string): Promise<LearningQuiz | null> {
  return executeWithRetry(async (db) =>
    db.collection<LearningQuiz>(COLLECTIONS.LEARNING_QUIZZES).findOne({ quizId })
  );
}

export async function createLearningQuiz(quiz: LearningQuiz): Promise<LearningQuiz> {
  await executeWithRetry(async (db) =>
    db.collection<LearningQuiz>(COLLECTIONS.LEARNING_QUIZZES).insertOne(quiz)
  );

  return quiz;
}

export async function createLearningQuizResult(
  result: LearningQuizResult
): Promise<LearningQuizResult> {
  await executeWithRetry(async (db) =>
    db.collection<LearningQuizResult>(COLLECTIONS.LEARNING_QUIZ_RESULTS).insertOne(result)
  );

  return result;
}

export async function getLearningQuizResultsForUser(
  userId: string
): Promise<LearningQuizResult[]> {
  return executeWithRetry(async (db) =>
    db
      .collection<LearningQuizResult>(COLLECTIONS.LEARNING_QUIZ_RESULTS)
      .find({ userId })
      .sort({ completedAt: -1 })
      .toArray()
  );
}

export async function getLearningQuizzesByIds(
  quizIds: string[]
): Promise<LearningQuiz[]> {
  if (quizIds.length === 0) {
    return [];
  }

  return executeWithRetry(async (db) =>
    db
      .collection<LearningQuiz>(COLLECTIONS.LEARNING_QUIZZES)
      .find({ quizId: { $in: quizIds } })
      .toArray()
  );
}
