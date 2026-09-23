import { ObjectId, type Db } from "mongodb";

import {
  buildAcademicPeriodUserQuery,
  isPrivilegedUserRecord,
  type AcademicPeriod,
} from "@/lib/academic-period";
import { COLLECTIONS } from "@/lib/database";
import { getLearnerTopicLabel } from "@/lib/learner-model";
import { resolveLearnerIdentityFromDb } from "@/lib/learner-identity";
import type { SubmissionModel } from "@/lib/models";
import type { StudentProfile } from "@/lib/student-profiles";
import type { UserModel } from "@/lib/users";

export type StudentProfileFreshnessStatus =
  | "current"
  | "stale"
  | "needs_recalculation"
  | "no_evidence";

export type StudentProfileAdminSummary = {
  academicPeriod: AcademicPeriod | null;
  lastCalculated: string | null;
  lastEvidenceUpdate: string | null;
  freshnessStatus: StudentProfileFreshnessStatus;
  freshnessReason: string;
  homeworkCompletion: {
    completed: number;
    started: number;
    missing: number;
    total: number;
    denominatorSource: "published_homework" | "none";
  };
  scoreSummary: {
    average: number | null;
    scoredSubmissions: number;
    source: "submissions" | "profile_snapshot" | "none";
  };
  riskSummary: {
    level: StudentProfile["riskFactors"]["riskLevel"];
    reason: string;
    assessedAt: string | null;
  };
  weakTopics: Array<{
    topic: string;
    label: string;
    mastery: number;
    confidence: number;
    evidenceCount: number;
    lastEvidenceTime: string | null;
  }>;
  recommendedAction: string;
  evidenceCounts: {
    profileEvidenceFields: number;
    sourceTypes: number;
    submissions: number;
    chatSessions: number;
    helpRequests: number;
  };
  flags: {
    missingSubmissions: boolean;
    lowActivity: boolean;
    staleProfile: boolean;
    needsReview: boolean;
    noEvidence: boolean;
  };
};

const STALE_PROFILE_DAYS = 14;
const LOW_ACTIVITY_DAYS = 14;
const RECALCULATION_DRIFT_MS = 5 * 60 * 1000;

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function getUserRecordId(user: UserModel): string | null {
  return user.id || user._id?.toString?.() || null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: unknown): string | null {
  return toDate(value)?.toISOString() ?? null;
}

function maxDate(values: unknown[]): Date | null {
  return values
    .map(toDate)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function daysSince(value: Date | null, now: Date) {
  if (!value) return Number.POSITIVE_INFINITY;
  return (now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000);
}

function getHomeworkSetId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof ObjectId) return value.toString();
  return String(value);
}

function getUserProfileIdentifiers(user: UserModel): unknown[] {
  const email = normalizeEmail(user.email);
  return [
    user.id,
    user._id,
    user._id?.toString?.(),
    email,
    user.email,
  ].filter(Boolean);
}

function getStudentIdentifiers(profile: StudentProfile, user?: UserModel | null): string[] {
  return Array.from(
    new Set(
      [
        profile.userId,
        profile._id?.toString?.(),
        normalizeEmail(profile.email),
        profile.email,
        user?.id,
        user?._id?.toString?.(),
        normalizeEmail(user?.email),
        user?.email,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function createUserIndex(users: UserModel[]): Map<string, UserModel> {
  const index = new Map<string, UserModel>();
  users.forEach((user) => {
    getUserProfileIdentifiers(user).forEach((identifier) => {
      index.set(String(identifier).trim().toLowerCase(), user);
    });
  });
  return index;
}

function findIndexedUser(profile: StudentProfile, index: Map<string, UserModel>) {
  const identifiers = getStudentIdentifiers(profile);
  for (const identifier of identifiers) {
    const user = index.get(identifier.toLowerCase());
    if (user) return user;
  }
  return null;
}

function getCompletionSummary(
  submissions: SubmissionModel[],
  publishedHomeworkIds: Set<string>
): StudentProfileAdminSummary["homeworkCompletion"] {
  const submittedHomeworkIds = new Set<string>();
  const startedHomeworkIds = new Set<string>();

  submissions.forEach((submission) => {
    const homeworkSetId = getHomeworkSetId(submission.homeworkSetId);
    if (!homeworkSetId || !publishedHomeworkIds.has(homeworkSetId)) return;

    startedHomeworkIds.add(homeworkSetId);
    if (submission.status === "submitted" || submission.status === "graded") {
      submittedHomeworkIds.add(homeworkSetId);
    }
  });

  const total = publishedHomeworkIds.size;
  return {
    completed: submittedHomeworkIds.size,
    started: startedHomeworkIds.size,
    missing: total > 0 ? Math.max(0, total - submittedHomeworkIds.size) : 0,
    total,
    denominatorSource: total > 0 ? "published_homework" : "none",
  };
}

function getScoreSummary(
  submissions: SubmissionModel[],
  profile: StudentProfile
): StudentProfileAdminSummary["scoreSummary"] {
  const scoredSubmissions = submissions
    .map((submission) => submission.overallScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  if (scoredSubmissions.length > 0) {
    return {
      average: Number(
        (
          scoredSubmissions.reduce((sum, score) => sum + score, 0) /
          scoredSubmissions.length
        ).toFixed(1)
      ),
      scoredSubmissions: scoredSubmissions.length,
      source: "submissions",
    };
  }

  if (typeof profile.averageGrade === "number" && profile.averageGrade > 0) {
    return {
      average: Number(profile.averageGrade.toFixed(1)),
      scoredSubmissions: 0,
      source: "profile_snapshot",
    };
  }

  return {
    average: null,
    scoredSubmissions: 0,
    source: "none",
  };
}

function getWeakTopics(profile: StudentProfile): StudentProfileAdminSummary["weakTopics"] {
  return (profile.topicMastery ?? [])
    .filter((record) => record.status === "measured")
    .slice()
    .sort((left, right) => {
      if (left.estimatedMastery !== right.estimatedMastery) {
        return left.estimatedMastery - right.estimatedMastery;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, 3)
    .map((record) => ({
      topic: record.topic,
      label: record.label || getLearnerTopicLabel(record.topic as never) || record.topic,
      mastery: record.estimatedMastery,
      confidence: record.confidence,
      evidenceCount: record.evidenceCount ?? 0,
      lastEvidenceTime: toIso(record.lastEvidenceTime),
    }));
}

function getLastCalculated(profile: StudentProfile): Date | null {
  const entries = Object.entries(profile.evidence ?? {})
    .filter(([field]) => field !== "adminOversight")
    .map(([, entry]) => entry.computedAt);

  return maxDate(entries);
}

function getLastEvidenceUpdate(profile: StudentProfile, submissions: SubmissionModel[]): Date | null {
  return maxDate([
    profile.lastActivity,
    profile.lastIssueUpdate,
    ...(profile.issueHistory ?? []).map((issue) => issue.detectedAt),
    ...(profile.topicMastery ?? []).map((record) => record.lastEvidenceTime),
    ...submissions.flatMap((submission) => [
      submission.updatedAt,
      submission.submittedAt,
      submission.gradedAt,
      submission.createdAt,
    ]),
  ]);
}

function getFreshnessStatus(input: {
  profile: StudentProfile;
  submissions: SubmissionModel[];
  lastCalculated: Date | null;
  lastEvidenceUpdate: Date | null;
  now: Date;
}): Pick<StudentProfileAdminSummary, "freshnessStatus" | "freshnessReason"> {
  const { profile, submissions, lastCalculated, lastEvidenceUpdate, now } = input;
  const profileEvidenceFields = Object.keys(profile.evidence ?? {}).length;
  const hasMeasuredEvidence =
    profileEvidenceFields > 0 ||
    submissions.length > 0 ||
    (profile.totalQuestions ?? 0) > 0 ||
    (profile.homeworkSubmissions ?? 0) > 0 ||
    (profile.topicMastery ?? []).some((record) => record.status === "measured") ||
    (profile.issueHistory ?? []).length > 0;

  if (!hasMeasuredEvidence) {
    return {
      freshnessStatus: "no_evidence",
      freshnessReason: "אין עדיין ראיות מדודות בפרופיל.",
    };
  }

  if (!lastCalculated) {
    return {
      freshnessStatus: "needs_recalculation",
      freshnessReason: "אין חותמת חישוב לפרופיל.",
    };
  }

  if (
    lastEvidenceUpdate &&
    lastEvidenceUpdate.getTime() - lastCalculated.getTime() > RECALCULATION_DRIFT_MS
  ) {
    return {
      freshnessStatus: "needs_recalculation",
      freshnessReason: "נמצאה פעילות חדשה יותר מחישוב הפרופיל.",
    };
  }

  if (daysSince(lastCalculated, now) > STALE_PROFILE_DAYS) {
    return {
      freshnessStatus: "stale",
      freshnessReason: `החישוב האחרון ישן מ-${STALE_PROFILE_DAYS} ימים.`,
    };
  }

  return {
    freshnessStatus: "current",
    freshnessReason: "הפרופיל מחושב על בסיס הראיות האחרונות הזמינות.",
  };
}

function getRiskReason(profile: StudentProfile, hasEvidence: boolean) {
  const explicitReason = profile.riskFactors?.riskFactors?.[0];
  if (explicitReason) return explicitReason;
  if (!hasEvidence) return "אין מספיק נתונים לקביעת סיכון.";
  if (profile.riskFactors?.riskLevel === "high") return "סומן כסיכון גבוה לפי חישוב הפרופיל.";
  if (profile.riskFactors?.riskLevel === "medium") return "קיימים אותות פדגוגיים שדורשים מעקב.";
  return "לא זוהה אות סיכון פעיל בפרופיל הנוכחי.";
}

function getRecommendedAction(input: {
  freshnessStatus: StudentProfileFreshnessStatus;
  completion: StudentProfileAdminSummary["homeworkCompletion"];
  scoreSummary: StudentProfileAdminSummary["scoreSummary"];
  riskLevel: StudentProfile["riskFactors"]["riskLevel"];
  weakTopics: StudentProfileAdminSummary["weakTopics"];
  lowActivity: boolean;
  noEvidence: boolean;
}) {
  const { freshnessStatus, completion, scoreSummary, riskLevel, weakTopics, lowActivity, noEvidence } = input;

  if (noEvidence) {
    return "לאסוף ראיות דרך מטלה קצרה או שיחה לפני תיוג פדגוגי.";
  }

  if (freshnessStatus === "needs_recalculation" || freshnessStatus === "stale") {
    return "להריץ חישוב מחדש לפני החלטת התערבות.";
  }

  if (riskLevel === "high") {
    return "לקבוע בדיקה אישית קצרה ולבדוק את הראיות בקונסולה.";
  }

  if (completion.total > 0 && completion.missing > 0) {
    return "לבדוק חסמי הגשה ולפתוח חלון אישי אם צריך.";
  }

  if (scoreSummary.average !== null && scoreSummary.average < 60) {
    return "לתת תרגול תיקון ממוקד לפני המטלה הבאה.";
  }

  if (weakTopics[0]) {
    return `לתת חיזוק ממוקד בנושא ${weakTopics[0].label}.`;
  }

  if (lowActivity) {
    return "לבדוק נוכחות/פעילות לפני הסקת מסקנות על ידע.";
  }

  return "מעקב רגיל; אין אות התערבות מיידי.";
}

export function isStudentUserRecord(user: UserModel): boolean {
  const email = normalizeEmail(user.email);
  if (!email) return false;
  return !isPrivilegedUserRecord(user);
}

export async function getScopedStudentUsers(
  db: Db,
  academicPeriod?: AcademicPeriod | null
): Promise<UserModel[]> {
  const users = await db
    .collection<UserModel>(COLLECTIONS.USERS)
    .find(buildAcademicPeriodUserQuery(academicPeriod) as never)
    .toArray();

  return users.filter(isStudentUserRecord);
}

export function buildProfileScopeQuery(users: UserModel[]) {
  const emails = Array.from(new Set(users.map((user) => normalizeEmail(user.email)).filter(Boolean)));
  const identifiers = Array.from(
    new Set(users.flatMap(getUserProfileIdentifiers).map((value) => value))
  );

  return {
    $or: [
      { email: { $in: emails } },
      { userId: { $in: identifiers } },
    ],
  };
}

export async function isStudentInAcademicPeriod(
  db: Db,
  identifier: string,
  academicPeriod?: AcademicPeriod | null
): Promise<boolean> {
  if (!academicPeriod) return true;

  const identity = await resolveLearnerIdentityFromDb(
    db,
    identifier,
    "admin-student-profile-summary.isStudentInAcademicPeriod"
  );
  const user = identity.user;
  if (!user || !isStudentUserRecord(user)) return false;

  return user.year === academicPeriod.year && user.semester === academicPeriod.semester;
}

export async function isStudentProfileInAcademicPeriod(
  db: Db,
  identifier: string,
  academicPeriod?: AcademicPeriod | null
): Promise<boolean> {
  if (!academicPeriod) return true;

  if (await isStudentInAcademicPeriod(db, identifier, academicPeriod)) {
    return true;
  }

  const normalizedIdentifier = normalizeEmail(identifier);
  const profile = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES).findOne(
    {
      $or: [
        { userId: identifier },
        ...(normalizedIdentifier ? [{ email: normalizedIdentifier }] : []),
      ],
    },
    { projection: { email: 1, userId: 1 } }
  );

  const profileEmail = normalizeEmail(profile?.email);
  if (!profileEmail || profileEmail === normalizedIdentifier) {
    return false;
  }

  return isStudentInAcademicPeriod(db, profileEmail, academicPeriod);
}

export async function buildAdminStudentProfileSummaries(
  db: Db,
  profiles: StudentProfile[],
  options: {
    academicPeriod?: AcademicPeriod | null;
    scopedUsers?: UserModel[];
  } = {}
): Promise<Map<string, StudentProfileAdminSummary>> {
  const now = new Date();
  const scopedUsers = options.scopedUsers ?? [];
  const userIndex = createUserIndex(scopedUsers);
  const publishedHomework = await db
    .collection(COLLECTIONS.HOMEWORK_SETS)
    .find(
      {
        published: true,
        visibility: "published",
        entryMode: { $ne: "hidden" },
      },
      { projection: { id: 1, _id: 1 } }
    )
    .limit(200)
    .toArray();
  const publishedHomeworkIds = new Set(
    publishedHomework
      .flatMap((homework) => [homework.id, homework._id?.toString?.()])
      .map(getHomeworkSetId)
      .filter((value): value is string => Boolean(value))
  );

  const profileContexts = profiles.map((profile) => {
    const user = findIndexedUser(profile, userIndex);
    const identifiers = getStudentIdentifiers(profile, user);
    return { profile, user, identifiers };
  });
  const allStudentIdentifiers = Array.from(
    new Set(profileContexts.flatMap((context) => context.identifiers))
  );

  const submissions =
    allStudentIdentifiers.length > 0 && publishedHomeworkIds.size > 0
      ? await db
          .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
          .find(
            {
              studentId: { $in: allStudentIdentifiers },
              homeworkSetId: { $in: Array.from(publishedHomeworkIds) },
            },
            {
              projection: {
                id: 1,
                homeworkSetId: 1,
                studentId: 1,
                status: 1,
                overallScore: 1,
                submittedAt: 1,
                gradedAt: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            }
          )
          .limit(5000)
          .toArray()
      : [];

  const submissionsByIdentifier = new Map<string, SubmissionModel[]>();
  submissions.forEach((submission) => {
    const key = String(submission.studentId || "").trim();
    if (!key) return;
    const bucket = submissionsByIdentifier.get(key) ?? [];
    bucket.push(submission);
    submissionsByIdentifier.set(key, bucket);
  });

  const summaries = new Map<string, StudentProfileAdminSummary>();

  profileContexts.forEach(({ profile, user, identifiers }) => {
    const profileSubmissions = identifiers.flatMap((identifier) => submissionsByIdentifier.get(identifier) ?? []);
    const uniqueProfileSubmissions = Array.from(
      new Map(profileSubmissions.map((submission) => [submission._id?.toString?.() || submission.id, submission])).values()
    );
    const completion = getCompletionSummary(uniqueProfileSubmissions, publishedHomeworkIds);
    const scoreSummary = getScoreSummary(uniqueProfileSubmissions, profile);
    const weakTopics = getWeakTopics(profile);
    const lastCalculated = getLastCalculated(profile);
    const lastEvidenceUpdate = getLastEvidenceUpdate(profile, uniqueProfileSubmissions);
    const freshness = getFreshnessStatus({
      profile,
      submissions: uniqueProfileSubmissions,
      lastCalculated,
      lastEvidenceUpdate,
      now,
    });
    const profileEvidenceFields = Object.values(profile.evidence ?? {});
    const sourceTypes = new Set(profileEvidenceFields.flatMap((entry) => entry.sources ?? [])).size;
    const noEvidence = freshness.freshnessStatus === "no_evidence";
    const lowActivity = noEvidence || daysSince(toDate(profile.lastActivity), now) > LOW_ACTIVITY_DAYS;
    const missingSubmissions = completion.total > 0 && completion.missing > 0;
    const staleProfile =
      freshness.freshnessStatus === "stale" ||
      freshness.freshnessStatus === "needs_recalculation";
    const needsReview =
      profile.riskFactors?.riskLevel === "high" ||
      profile.riskFactors?.riskLevel === "medium" ||
      (profile.issueCount ?? 0) > 0 ||
      staleProfile ||
      missingSubmissions ||
      weakTopics.some((topic) => topic.confidence >= 0.7 && topic.mastery <= 0.5);

    const riskLevel = profile.riskFactors?.riskLevel ?? "low";
    const summary: StudentProfileAdminSummary = {
      academicPeriod:
        typeof user?.year === "number" && typeof user?.semester === "number"
          ? { year: user.year, semester: user.semester }
          : options.academicPeriod ?? null,
      lastCalculated: lastCalculated?.toISOString() ?? null,
      lastEvidenceUpdate: lastEvidenceUpdate?.toISOString() ?? null,
      freshnessStatus: freshness.freshnessStatus,
      freshnessReason: freshness.freshnessReason,
      homeworkCompletion: completion,
      scoreSummary,
      riskSummary: {
        level: riskLevel,
        reason: getRiskReason(profile, !noEvidence),
        assessedAt: toIso(profile.riskFactors?.lastAssessment),
      },
      weakTopics,
      recommendedAction: getRecommendedAction({
        freshnessStatus: freshness.freshnessStatus,
        completion,
        scoreSummary,
        riskLevel,
        weakTopics,
        lowActivity,
        noEvidence,
      }),
      evidenceCounts: {
        profileEvidenceFields: profileEvidenceFields.length,
        sourceTypes,
        submissions: uniqueProfileSubmissions.length,
        chatSessions: profile.engagementMetrics?.chatSessions ?? 0,
        helpRequests: profile.engagementMetrics?.helpRequests ?? 0,
      },
      flags: {
        missingSubmissions,
        lowActivity,
        staleProfile,
        needsReview,
        noEvidence,
      },
    };

    summaries.set(String(profile._id?.toString?.() || profile.userId), summary);
  });

  return summaries;
}
