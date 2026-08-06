import { ObjectId } from 'mongodb';

import { COLLECTIONS, executeWithRetry } from '@/lib/database';
import type { HomeworkPersonalAccessWindow } from '@/lib/deadline-utils';

export interface HomeworkAccessOverride {
  id: string;
  homeworkSetId: string;
  userEmail: string;
  availableFrom: string;
  availableUntil: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface HomeworkAccessOverrideModel extends Omit<HomeworkAccessOverride, 'id'> {
  _id?: ObjectId;
}

export interface UpsertHomeworkAccessOverrideInput {
  homeworkSetId: string;
  userEmail: string;
  availableFrom: string;
  availableUntil: string;
  actorEmail: string;
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeOverride(record: HomeworkAccessOverrideModel): HomeworkAccessOverride {
  return {
    id: record._id?.toString() || '',
    homeworkSetId: record.homeworkSetId,
    userEmail: normalizeEmail(record.userEmail),
    availableFrom: record.availableFrom,
    availableUntil: record.availableUntil,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toStrictPersonalAccessWindow(
  override: HomeworkAccessOverride | null | undefined,
): HomeworkPersonalAccessWindow | null {
  if (!override) return null;
  return {
    availableFrom: override.availableFrom,
    availableUntil: override.availableUntil,
    strict: true,
    source: 'db',
  };
}

export async function getHomeworkAccessOverride(
  homeworkSetId: string,
  userEmail: string | null | undefined,
): Promise<HomeworkAccessOverride | null> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!homeworkSetId || !normalizedEmail) return null;

  return executeWithRetry(async (db) => {
    const record = await db.collection<HomeworkAccessOverrideModel>(COLLECTIONS.HOMEWORK_ACCESS_OVERRIDES).findOne({
      homeworkSetId,
      userEmail: normalizedEmail,
    });
    return record ? normalizeOverride(record) : null;
  });
}

export async function getHomeworkAccessOverridesForUser(
  userEmail: string | null | undefined,
): Promise<Map<string, HomeworkAccessOverride>> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return new Map();

  return executeWithRetry(async (db) => {
    const records = await db
      .collection<HomeworkAccessOverrideModel>(COLLECTIONS.HOMEWORK_ACCESS_OVERRIDES)
      .find({ userEmail: normalizedEmail })
      .toArray();

    return new Map(records.map((record) => {
      const normalized = normalizeOverride(record);
      return [normalized.homeworkSetId, normalized] as const;
    }));
  });
}

export async function getHomeworkAccessOverridesForSet(
  homeworkSetId: string,
): Promise<Map<string, HomeworkAccessOverride>> {
  if (!homeworkSetId) return new Map();

  return executeWithRetry(async (db) => {
    const records = await db
      .collection<HomeworkAccessOverrideModel>(COLLECTIONS.HOMEWORK_ACCESS_OVERRIDES)
      .find({ homeworkSetId })
      .toArray();

    return new Map(records.map((record) => {
      const normalized = normalizeOverride(record);
      return [normalized.userEmail, normalized] as const;
    }));
  });
}

export async function upsertHomeworkAccessOverride(
  input: UpsertHomeworkAccessOverrideInput,
): Promise<HomeworkAccessOverride> {
  const userEmail = normalizeEmail(input.userEmail);
  const availableFrom = new Date(input.availableFrom);
  const availableUntil = new Date(input.availableUntil);

  if (!input.homeworkSetId.trim()) {
    throw new Error('homeworkSetId is required');
  }
  if (!userEmail) {
    throw new Error('userEmail is required');
  }
  if (Number.isNaN(availableFrom.getTime()) || Number.isNaN(availableUntil.getTime())) {
    throw new Error('valid availableFrom and availableUntil are required');
  }
  if (availableFrom.getTime() >= availableUntil.getTime()) {
    throw new Error('availableFrom must be before availableUntil');
  }

  return executeWithRetry(async (db) => {
    const now = new Date().toISOString();
    const result = await db
      .collection<HomeworkAccessOverrideModel>(COLLECTIONS.HOMEWORK_ACCESS_OVERRIDES)
      .findOneAndUpdate(
        {
          homeworkSetId: input.homeworkSetId,
          userEmail,
        },
        {
          $set: {
            homeworkSetId: input.homeworkSetId,
            userEmail,
            availableFrom: availableFrom.toISOString(),
            availableUntil: availableUntil.toISOString(),
            updatedBy: normalizeEmail(input.actorEmail),
            updatedAt: now,
          },
          $setOnInsert: {
            createdBy: normalizeEmail(input.actorEmail),
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

    if (!result) {
      throw new Error('Failed to save homework access override');
    }

    return normalizeOverride(result);
  });
}

export async function deleteHomeworkAccessOverride(
  homeworkSetId: string,
  userEmail: string | null | undefined,
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!homeworkSetId || !normalizedEmail) return false;

  return executeWithRetry(async (db) => {
    const result = await db.collection(COLLECTIONS.HOMEWORK_ACCESS_OVERRIDES).deleteOne({
      homeworkSetId,
      userEmail: normalizedEmail,
    });
    return result.deletedCount > 0;
  });
}
