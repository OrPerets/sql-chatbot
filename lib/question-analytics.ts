import { ObjectId } from 'mongodb';
import { COLLECTIONS, connectToDatabase } from './database';
import { QuestionAnalyticsModel } from './models';

export interface QuestionAnalyticsPayload {
  submissionId: string;
  questionId: string;
  studentId: string;
  homeworkSetId: string;
  metrics: QuestionAnalyticsModel['metrics'];
}

export interface QuestionAnalyticsStatsQuery {
  setId?: string;
  questionId?: string;
  studentId?: string;
  from?: string;
  to?: string;
}

export interface QuestionAnalyticsStats {
  questionId: string;
  totalRecords: number;
  totalShowAnswerClicks: number;
  averageShowAnswerClicks: number;
  averageTimeToFirstShowAnswer: number | null;
  studentsWithShowAnswer: number;
}

export async function saveQuestionAnalytics(payload: QuestionAnalyticsPayload) {
  const { db } = await connectToDatabase();
  const collection = db.collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS);
  const now = new Date().toISOString();

  await collection.updateOne(
    { submissionId: payload.submissionId, questionId: payload.questionId },
    {
      $set: {
        ...payload,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: now,
      },
    },
    { upsert: true }
  );

  return payload;
}

export async function getQuestionAnalyticsStats(
  query: QuestionAnalyticsStatsQuery
): Promise<QuestionAnalyticsStats[]> {
  const { db } = await connectToDatabase();
  const collection = db.collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS);

  const match: Record<string, unknown> = {};

  if (query.setId) {
    match.homeworkSetId = query.setId;
  }
  if (query.questionId) {
    match.questionId = query.questionId;
  }
  if (query.studentId) {
    match.studentId = query.studentId;
  }
  if (query.from || query.to) {
    match.updatedAt = {};
    if (query.from) {
      (match.updatedAt as Record<string, string>).$gte = query.from;
    }
    if (query.to) {
      (match.updatedAt as Record<string, string>).$lte = query.to;
    }
  }

  const pipeline = [
    { $match: match },
    {
      $project: {
        questionId: 1,
        showAnswerClicks: { $ifNull: ["$metrics.showAnswerClicks", 0] },
        timeToFirstShowAnswer: "$metrics.timeToFirstShowAnswer",
      },
    },
    {
      $group: {
        _id: "$questionId",
        totalRecords: { $sum: 1 },
        totalShowAnswerClicks: { $sum: "$showAnswerClicks" },
        averageShowAnswerClicks: { $avg: "$showAnswerClicks" },
        timeToFirstShowAnswerSum: {
          $sum: {
            $cond: [
              { $gt: ["$timeToFirstShowAnswer", 0] },
              "$timeToFirstShowAnswer",
              0,
            ],
          },
        },
        timeToFirstShowAnswerCount: {
          $sum: {
            $cond: [{ $gt: ["$timeToFirstShowAnswer", 0] }, 1, 0],
          },
        },
        studentsWithShowAnswer: {
          $sum: {
            $cond: [{ $gt: ["$showAnswerClicks", 0] }, 1, 0],
          },
        },
      },
    },
  ];

  const results = await collection.aggregate(pipeline).toArray();

  return results.map((result) => ({
    questionId: result._id as string,
    totalRecords: result.totalRecords ?? 0,
    totalShowAnswerClicks: result.totalShowAnswerClicks ?? 0,
    averageShowAnswerClicks: Math.round((result.averageShowAnswerClicks ?? 0) * 10) / 10,
    averageTimeToFirstShowAnswer:
      result.timeToFirstShowAnswerCount > 0
        ? Math.round((result.timeToFirstShowAnswerSum / result.timeToFirstShowAnswerCount) * 10) / 10
        : null,
    studentsWithShowAnswer: result.studentsWithShowAnswer ?? 0,
  }));
}
