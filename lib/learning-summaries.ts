import { ObjectId } from 'mongodb';

import { COLLECTIONS, executeWithRetry } from '@/lib/database';

export type LearningSummaryMode = 'full' | 'highlights';

export interface LearningSummary {
  _id?: ObjectId;
  userId: string;
  pdfId: string;
  summaryMode: LearningSummaryMode;
  content: string;
  pageRange?: {
    start: number;
    end: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export async function getLearningSummary(
  userId: string,
  pdfId: string,
  summaryMode: LearningSummaryMode
): Promise<LearningSummary | null> {
  return executeWithRetry(async (db) =>
    db.collection<LearningSummary>(COLLECTIONS.LEARNING_SUMMARIES).findOne({
      userId,
      pdfId,
      summaryMode,
    })
  );
}

export async function upsertLearningSummary(
  userId: string,
  pdfId: string,
  summaryMode: LearningSummaryMode,
  content: string,
  pageRange?: { start: number; end: number }
): Promise<LearningSummary> {
  const now = new Date();

  await executeWithRetry(async (db) =>
    db.collection<LearningSummary>(COLLECTIONS.LEARNING_SUMMARIES).updateOne(
      { userId, pdfId, summaryMode },
      {
        $set: {
          content,
          updatedAt: now,
          pageRange: pageRange ?? undefined,
        },
        $setOnInsert: {
          userId,
          pdfId,
          summaryMode,
          createdAt: now,
        },
      },
      { upsert: true }
    )
  );

  const summary = await getLearningSummary(userId, pdfId, summaryMode);
  if (!summary) {
    return {
      userId,
      pdfId,
      summaryMode,
      content,
      pageRange,
      createdAt: now,
      updatedAt: now,
    };
  }

  return summary;
}
