import { COLLECTIONS, executeWithRetry } from "@/lib/database";

export type StudentPreferenceKey =
  | "preferred_language"
  | "preferred_explanation_depth"
  | "repeated_sql_weaknesses"
  | "exam_prep_goals";

export type StudentPreference = {
  _id?: unknown;
  userId: string;
  key: StudentPreferenceKey;
  value: string;
  notes?: string;
  source: "student" | "assistant" | "system";
  updatedAt: Date;
  createdAt: Date;
};

export async function listStudentPreferences(
  userId: string
): Promise<StudentPreference[]> {
  return executeWithRetry(async (db) =>
    db
      .collection<StudentPreference>(COLLECTIONS.STUDENT_PREFERENCES)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray()
  );
}

export async function upsertStudentPreference(input: {
  userId: string;
  key: StudentPreferenceKey;
  value: string;
  notes?: string;
  source?: StudentPreference["source"];
}): Promise<StudentPreference> {
  const now = new Date();

  await executeWithRetry(async (db) =>
    db.collection<StudentPreference>(COLLECTIONS.STUDENT_PREFERENCES).updateOne(
      {
        userId: input.userId,
        key: input.key,
      },
      {
        $set: {
          value: input.value,
          notes: input.notes,
          source: input.source || "assistant",
          updatedAt: now,
        },
        $setOnInsert: {
          userId: input.userId,
          key: input.key,
          createdAt: now,
        },
      },
      { upsert: true }
    )
  );

  const [preference] = await listStudentPreferences(input.userId);
  return (
    preference || {
      userId: input.userId,
      key: input.key,
      value: input.value,
      notes: input.notes,
      source: input.source || "assistant",
      updatedAt: now,
      createdAt: now,
    }
  );
}
