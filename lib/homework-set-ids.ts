import { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "./database";

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

export function buildHomeworkSetLookupQuery(homeworkSetId: string) {
  const conditions: any[] = [{ id: homeworkSetId }];

  if (isObjectIdString(homeworkSetId)) {
    conditions.unshift({ _id: new ObjectId(homeworkSetId) });
  }

  return { $or: conditions };
}

export async function resolveHomeworkSetIdAliases(db: Db, homeworkSetId: string): Promise<string[]> {
  const aliases = new Set<string>([homeworkSetId]);
  const homeworkSet = await db
    .collection(COLLECTIONS.HOMEWORK_SETS)
    .findOne(buildHomeworkSetLookupQuery(homeworkSetId), { projection: { id: 1 } });

  if (homeworkSet?.id) {
    aliases.add(homeworkSet.id);
  }
  if (homeworkSet?._id) {
    aliases.add(homeworkSet._id.toString());
  }

  return Array.from(aliases);
}

export async function buildHomeworkSetIdQuery(db: Db, homeworkSetId: string) {
  const aliases = await resolveHomeworkSetIdAliases(db, homeworkSetId);
  return { homeworkSetId: { $in: aliases } };
}
