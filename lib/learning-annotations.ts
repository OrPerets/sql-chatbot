import { ObjectId } from 'mongodb';

import { COLLECTIONS, executeWithRetry } from '@/lib/database';

export type LearningAnnotationType = 'draw' | 'highlight';

export type LearningAnnotationPoint = {
  x: number;
  y: number;
};

export type LearningAnnotation = {
  id: string;
  page: number;
  type: LearningAnnotationType;
  color: string;
  thickness: number;
  points: LearningAnnotationPoint[];
  createdAt: Date;
};

export type LearningAnnotationsDocument = {
  _id?: ObjectId;
  userId: string;
  pdfId: string;
  annotations: LearningAnnotation[];
  createdAt: Date;
  updatedAt: Date;
};

export async function getLearningAnnotations(
  userId: string,
  pdfId: string
): Promise<LearningAnnotationsDocument | null> {
  return executeWithRetry(async (db) =>
    db.collection<LearningAnnotationsDocument>(COLLECTIONS.LEARNING_ANNOTATIONS).findOne({
      userId,
      pdfId,
    })
  );
}

export async function upsertLearningAnnotations(
  userId: string,
  pdfId: string,
  annotations: LearningAnnotation[]
): Promise<LearningAnnotationsDocument> {
  const now = new Date();

  await executeWithRetry(async (db) =>
    db.collection<LearningAnnotationsDocument>(COLLECTIONS.LEARNING_ANNOTATIONS).updateOne(
      { userId, pdfId },
      {
        $set: {
          annotations,
          updatedAt: now,
        },
        $setOnInsert: {
          userId,
          pdfId,
          createdAt: now,
        },
      },
      { upsert: true }
    )
  );

  const document = await getLearningAnnotations(userId, pdfId);
  if (!document) {
    return {
      userId,
      pdfId,
      annotations,
      createdAt: now,
      updatedAt: now,
    };
  }

  return document;
}
