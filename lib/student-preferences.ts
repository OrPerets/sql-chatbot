import { COLLECTIONS, executeWithRetry } from "@/lib/database";
import {
  buildLearnerIdentifierQuery,
  normalizeLearnerRecords,
  resolveLearnerIdentityFromDb,
} from "@/lib/learner-identity";

export const STUDENT_PREFERENCE_KEYS = [
  "preferred_language",
  "preferred_explanation_depth",
  "explanation_style",
  "example_density",
  "step_by_step_tolerance",
  "self_confidence_level",
  "pace_preference",
  "desired_challenge_level",
  "learning_goal",
  "current_study_goal",
  "preferred_hint_style",
  "preferred_correction_style",
  "weak_topics_self_report",
  "repeated_sql_weaknesses",
  "accessibility_needs",
  "exam_prep_goals",
] as const;

export type StudentPreferenceKey = (typeof STUDENT_PREFERENCE_KEYS)[number];

export type StudentPreferenceSource =
  | "student"
  | "assistant"
  | "system"
  | "inferred";

export type StudentPreferenceScope = "stable" | "session";

export type StudentPreference = {
  _id?: unknown;
  userId: string;
  key: StudentPreferenceKey;
  value: string;
  notes?: string;
  source: StudentPreferenceSource;
  scope: StudentPreferenceScope;
  confidence: number;
  updatedAt: Date;
  createdAt: Date;
};

export const STUDENT_PREFERENCE_DEFINITIONS: Record<
  StudentPreferenceKey,
  { label: string; scope: StudentPreferenceScope }
> = {
  preferred_language: { label: "Preferred language", scope: "stable" },
  preferred_explanation_depth: { label: "Preferred explanation depth", scope: "stable" },
  explanation_style: { label: "Explanation style", scope: "stable" },
  example_density: { label: "Example density", scope: "stable" },
  step_by_step_tolerance: { label: "Step-by-step tolerance", scope: "stable" },
  self_confidence_level: { label: "Self confidence level", scope: "session" },
  pace_preference: { label: "Pace preference", scope: "stable" },
  desired_challenge_level: { label: "Desired challenge level", scope: "stable" },
  learning_goal: { label: "Learning goal", scope: "stable" },
  current_study_goal: { label: "Current study goal", scope: "session" },
  preferred_hint_style: { label: "Preferred hint style", scope: "stable" },
  preferred_correction_style: { label: "Preferred correction style", scope: "stable" },
  weak_topics_self_report: { label: "Self-reported weak topics", scope: "stable" },
  repeated_sql_weaknesses: { label: "Repeated SQL weaknesses", scope: "stable" },
  accessibility_needs: { label: "Accessibility needs", scope: "stable" },
  exam_prep_goals: { label: "Exam prep goals", scope: "stable" },
};

const STUDENT_PREFERENCE_KEY_SET = new Set<string>(STUDENT_PREFERENCE_KEYS);

export function normalizeStudentPreferenceKey(
  key: string | null | undefined
): StudentPreferenceKey | null {
  const trimmed = key?.trim();
  if (!trimmed) {
    return null;
  }

  return STUDENT_PREFERENCE_KEY_SET.has(trimmed)
    ? (trimmed as StudentPreferenceKey)
    : null;
}

export async function listStudentPreferences(
  userId: string
): Promise<StudentPreference[]> {
  return executeWithRetry(async (db) => {
    const identity = await resolveLearnerIdentityFromDb(
      db,
      userId,
      "student-preferences.list"
    );
    await normalizeLearnerRecords(db, identity, "student-preferences.list");

    return db
      .collection<StudentPreference>(COLLECTIONS.STUDENT_PREFERENCES)
      .find({ userId: identity.canonicalId })
      .sort({ updatedAt: -1 })
      .toArray();
  });
}

export async function upsertStudentPreference(input: {
  userId: string;
  key: StudentPreferenceKey;
  value: string;
  notes?: string;
  source?: StudentPreferenceSource;
  scope?: StudentPreferenceScope;
  confidence?: number;
}): Promise<StudentPreference> {
  const now = new Date();
  const key = normalizeStudentPreferenceKey(input.key);

  if (!key) {
    throw new Error(`Unsupported preference key: ${String(input.key)}`);
  }

  const canonicalUserId = await executeWithRetry(async (db) => {
    const identity = await resolveLearnerIdentityFromDb(
      db,
      input.userId,
      "student-preferences.upsert"
    );
    await normalizeLearnerRecords(db, identity, "student-preferences.upsert");

    const scope =
      input.scope ?? STUDENT_PREFERENCE_DEFINITIONS[key].scope ?? "stable";
    const confidence = Math.max(
      0,
      Math.min(1, typeof input.confidence === "number" ? input.confidence : 1)
    );

    await db.collection<StudentPreference>(COLLECTIONS.STUDENT_PREFERENCES).updateOne(
      {
        ...buildLearnerIdentifierQuery("userId", identity),
        key,
      },
      {
        $set: {
          userId: identity.canonicalId,
          key,
          value: input.value,
          notes: input.notes,
          source: input.source || "assistant",
          scope,
          confidence,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return identity.canonicalId;
  });

  const preferences = await listStudentPreferences(canonicalUserId);
  const preference = preferences.find((entry) => entry.key === key);

  return (
    preference || {
      userId: canonicalUserId,
      key,
      value: input.value,
      notes: input.notes,
      source: input.source || "assistant",
      scope: input.scope ?? STUDENT_PREFERENCE_DEFINITIONS[key].scope,
      confidence: Math.max(
        0,
        Math.min(1, typeof input.confidence === "number" ? input.confidence : 1)
      ),
      updatedAt: now,
      createdAt: now,
    }
  );
}
