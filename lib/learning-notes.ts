import { ObjectId } from 'mongodb';

import { COLLECTIONS, executeWithRetry } from '@/lib/database';

export type LearningNoteTargetType = 'pdf' | 'topic';

export interface LearningNote {
  _id?: ObjectId;
  userId: string;
  targetType: LearningNoteTargetType;
  targetId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getLearningNote(
  userId: string,
  targetType: LearningNoteTargetType,
  targetId: string
): Promise<LearningNote | null> {
  return executeWithRetry(async (db) =>
    db.collection<LearningNote>(COLLECTIONS.STUDENT_NOTES).findOne({
      userId,
      targetType,
      targetId,
    })
  );
}

export async function upsertLearningNote(
  userId: string,
  targetType: LearningNoteTargetType,
  targetId: string,
  content: string
): Promise<LearningNote> {
  const now = new Date();

  await executeWithRetry(async (db) =>
    db.collection<LearningNote>(COLLECTIONS.STUDENT_NOTES).updateOne(
      { userId, targetType, targetId },
      {
        $set: {
          content,
          updatedAt: now,
        },
        $setOnInsert: {
          userId,
          targetType,
          targetId,
          createdAt: now,
        },
      },
      { upsert: true }
    )
  );

  const note = await getLearningNote(userId, targetType, targetId);
  if (!note) {
    return {
      userId,
      targetType,
      targetId,
      content,
      createdAt: now,
      updatedAt: now,
    };
  }

  return note;
}

export async function getLearningNotesForUser(userId: string): Promise<LearningNote[]> {
  return executeWithRetry(async (db) =>
    db
      .collection<LearningNote>(COLLECTIONS.STUDENT_NOTES)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray()
  );
}
