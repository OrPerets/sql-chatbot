import { Db, ObjectId } from "mongodb";

import { COLLECTIONS, connectToDatabase, executeWithRetry } from "@/lib/database";
import type { UserModel } from "@/lib/users";

export type ResolvedLearnerIdentity = {
  input: string;
  canonicalId: string;
  email: string | null;
  identifiers: string[];
  matchedBy: "objectId" | "id" | "email" | "fallback";
  user: UserModel | null;
};

const PERSONALIZATION_COLLECTION_FIELDS = [
  { collection: COLLECTIONS.STUDENT_PROFILES, field: "userId" },
  { collection: COLLECTIONS.STUDENT_PREFERENCES, field: "userId" },
  { collection: COLLECTIONS.STUDENT_ACTIVITIES, field: "userId" },
  { collection: COLLECTIONS.ANALYSIS_RESULTS, field: "studentId" },
  { collection: COLLECTIONS.LEARNING_QUIZ_RESULTS, field: "userId" },
  { collection: COLLECTIONS.ANALYTICS, field: "actorId" },
] as const;

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueIdentifiers(values: Array<unknown>): string[] {
  return Array.from(
    new Set(values.map(normalizeIdentifier).filter((value): value is string => Boolean(value)))
  );
}

async function findUserByIdentifier(db: Db, identifier: string): Promise<{
  user: UserModel | null;
  matchedBy: ResolvedLearnerIdentity["matchedBy"];
}> {
  const users = db.collection<UserModel>(COLLECTIONS.USERS);

  if (identifier.includes("@")) {
    const byEmail = await users.findOne({ email: identifier });
    if (byEmail) {
      return { user: byEmail, matchedBy: "email" };
    }
  }

  if (ObjectId.isValid(identifier)) {
    const byObjectId = await users.findOne({ _id: new ObjectId(identifier) } as never);
    if (byObjectId) {
      return { user: byObjectId, matchedBy: "objectId" };
    }
  }

  const byId = await users.findOne({ id: identifier });
  if (byId) {
    return { user: byId, matchedBy: "id" };
  }

  if (!identifier.includes("@")) {
    const fallbackEmail = await users.findOne({ email: identifier });
    if (fallbackEmail) {
      return { user: fallbackEmail, matchedBy: "email" };
    }
  }

  return { user: null, matchedBy: "fallback" };
}

export async function resolveLearnerIdentityFromDb(
  db: Db,
  identifier: string,
  context: string = "unknown"
): Promise<ResolvedLearnerIdentity> {
  const input = normalizeIdentifier(identifier);
  if (!input) {
    throw new Error("Learner identifier is required");
  }

  const { user, matchedBy } = await findUserByIdentifier(db, input);
  const canonicalId =
    normalizeIdentifier(user?.id) ??
    normalizeIdentifier(user?._id?.toString()) ??
    input;
  const email = normalizeIdentifier(user?.email) ?? (input.includes("@") ? input : null);
  const identifiers = uniqueIdentifiers([
    input,
    canonicalId,
    email,
    user?.id,
    user?._id?.toString(),
  ]);

  if (input !== canonicalId && input !== email) {
    console.warn("[learner-identity] Canonicalized learner identifier", {
      context,
      input,
      canonicalId,
      email,
      matchedBy,
    });
  }

  return {
    input,
    canonicalId,
    email,
    identifiers,
    matchedBy,
    user,
  };
}

export async function resolveLearnerIdentity(
  identifier: string,
  context?: string
): Promise<ResolvedLearnerIdentity> {
  return executeWithRetry((db) => resolveLearnerIdentityFromDb(db, identifier, context));
}

export function buildLearnerIdentifierQuery(
  field: string,
  identity: Pick<ResolvedLearnerIdentity, "identifiers">
) {
  if (identity.identifiers.length === 1) {
    return { [field]: identity.identifiers[0] };
  }

  return { [field]: { $in: identity.identifiers } };
}

export async function normalizeLearnerRecords(
  db: Db,
  identity: ResolvedLearnerIdentity,
  context: string = "unknown"
): Promise<void> {
  const legacyIdentifiers = identity.identifiers.filter(
    (value) => value !== identity.canonicalId
  );

  if (legacyIdentifiers.length === 0) {
    return;
  }

  const updates = await Promise.all(
    PERSONALIZATION_COLLECTION_FIELDS.map(async ({ collection, field }) => {
      const result = await db.collection(collection).updateMany(
        {
          [field]: { $in: legacyIdentifiers },
        },
        {
          $set: {
            [field]: identity.canonicalId,
          },
        }
      );

      return {
        collection,
        modifiedCount: result.modifiedCount ?? 0,
      };
    })
  );

  const changedCollections = updates.filter((entry) => entry.modifiedCount > 0);
  if (changedCollections.length > 0) {
    console.warn("[learner-identity] Migrated legacy learner identifiers", {
      context,
      canonicalId: identity.canonicalId,
      legacyIdentifiers,
      updates: changedCollections,
    });
  }
}

export async function resolveAndNormalizeLearnerIdentity(
  identifier: string,
  context?: string
): Promise<ResolvedLearnerIdentity> {
  const { db } = await connectToDatabase();
  const identity = await resolveLearnerIdentityFromDb(db, identifier, context);
  await normalizeLearnerRecords(db, identity, context);
  return identity;
}
