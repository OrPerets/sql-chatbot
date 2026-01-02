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

