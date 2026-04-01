import { ObjectId, type Db } from "mongodb";

import { COLLECTIONS } from "@/lib/database";
import { getFreshnessLabel, getFreshnessScore } from "@/lib/freshness";
import {
  normalizeLearnerRecords,
  resolveLearnerIdentityFromDb,
} from "@/lib/learner-identity";
import type { StudentProfile } from "@/lib/student-profiles";

type RawStudentSignals = {
  canonicalUserId: string;
  email: string | null;
  userName: string | null;
  sourceIdentifiers: string[];
  chatSessions: any[];
  chatMessages: any[];
  homeworkSubmissions: any[];
  conversationSummaries: any[];
  studentActivities: any[];
};

type DerivedLearnerState = {
  lastActivity: Date;
  totalQuestions: number;
  correctAnswers: number;
  homeworkSubmissions: number;
  averageGrade: number;
  commonChallenges: string[];
  knowledgeScore: StudentProfile["knowledgeScore"];
  learningProgress: StudentProfile["learningProgress"];
  engagementMetrics: StudentProfile["engagementMetrics"];
  riskFactors: StudentProfile["riskFactors"];
  conversationInsights: StudentProfile["conversationInsights"];
  evidence: StudentProfile["evidence"];
};

const PROGRESS_TOPICS = {
  sqlBasics: ["select", "projection", "basic"],
  joins: ["join"],
  aggregations: ["group by", "having", "aggregate", "count", "sum", "avg"],
  subqueries: ["subquery", "nested query"],
  advancedQueries: ["window", "advanced", "complex", "cte"],
} as const;

function buildEvidenceEntry(
  computedAt: Date,
  sources: string[],
  evidence: Record<string, unknown>,
  confidence: number
): NonNullable<StudentProfile["evidence"]>[string] {
  const freshnessScore = getFreshnessScore(computedAt, {
    freshHours: 24 * 3,
    staleHours: 24 * 30,
  });

  return {
    computedAt,
    sources,
    evidence,
    confidence: Number(confidence.toFixed(3)),
    freshnessScore,
    freshnessLabel: getFreshnessLabel(freshnessScore),
  };
}

export async function recalculateStudentProfile(
  db: Db,
  identifier: string
): Promise<{ profile: StudentProfile | null; created: boolean }> {
  const identity = await resolveLearnerIdentityFromDb(
    db,
    identifier,
    "student-profile-recalculation"
  );
  await normalizeLearnerRecords(db, identity, "student-profile-recalculation");

  const existingProfile = await db
    .collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
    .findOne({ userId: identity.canonicalId });

  const signals = await aggregateRawSignals(db, identity.canonicalId);
  const derivedState = deriveLearnerState(signals);
  await persistProfileSnapshot(db, signals, derivedState, existingProfile);

  const profile = await db
    .collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
    .findOne({ userId: identity.canonicalId });

  return {
    profile,
    created: !existingProfile,
  };
}

export async function aggregateRawSignals(
  db: Db,
  identifier: string
): Promise<RawStudentSignals> {
  const identity = await resolveLearnerIdentityFromDb(
    db,
    identifier,
    "student-profile-recalculation.aggregateRawSignals"
  );
  await normalizeLearnerRecords(
    db,
    identity,
    "student-profile-recalculation.aggregateRawSignals"
  );

  const userLookup =
    (ObjectId.isValid(identity.canonicalId)
      ? db
          .collection(COLLECTIONS.USERS)
          .findOne({ _id: new ObjectId(identity.canonicalId) } as never)
      : Promise.resolve(null)) as Promise<any>;

  const [
    userByObjectId,
    userByCustomId,
    chatSessions,
    chatMessages,
    homeworkSubmissions,
    conversationSummaries,
    studentActivities,
  ] = await Promise.all([
    userLookup,
    db.collection(COLLECTIONS.USERS).findOne({ id: identity.canonicalId }),
    db
      .collection(COLLECTIONS.CHAT_SESSIONS)
      .find({ userId: { $in: identity.identifiers } })
      .toArray(),
    db
      .collection(COLLECTIONS.CHAT_MESSAGES)
      .find({ userId: { $in: identity.identifiers } })
      .toArray(),
    db
      .collection(COLLECTIONS.SUBMISSIONS)
      .find({ studentId: { $in: identity.identifiers } })
      .toArray(),
    db
      .collection(COLLECTIONS.CONVERSATION_SUMMARIES)
      .find({ userId: { $in: identity.identifiers } })
      .toArray(),
    db
      .collection(COLLECTIONS.STUDENT_ACTIVITIES)
      .find({ userId: { $in: identity.identifiers } })
      .toArray(),
  ]);

  const user = userByObjectId || userByCustomId;

  return {
    canonicalUserId: identity.canonicalId,
    email: identity.email,
    userName: user?.name || null,
    sourceIdentifiers: identity.identifiers,
    chatSessions,
    chatMessages,
    homeworkSubmissions,
    conversationSummaries,
    studentActivities,
  };
}

export function deriveLearnerState(signals: RawStudentSignals): DerivedLearnerState {
  const now = new Date();
  const totalQuestions = signals.chatMessages.filter((message) => message.role === "user").length;
  const successfulPracticeAttempts = signals.studentActivities.filter(
    (activity) => activity.activityType === "practice" && activity.activityData?.success
  ).length;
  const gradedAnswerScores = signals.homeworkSubmissions.flatMap((submission) =>
    Object.values(submission.answers || {})
      .map((answer: any) => answer?.feedback?.score)
      .filter((score): score is number => typeof score === "number")
  );
  const correctAnswers =
    successfulPracticeAttempts + gradedAnswerScores.filter((score) => score > 0).length;

  const homeworkGrades = signals.homeworkSubmissions
    .map((submission) => submission.overallScore)
    .filter((score): score is number => typeof score === "number");

  const averageGrade =
    homeworkGrades.length > 0
      ? Number(
          (
            homeworkGrades.reduce((sum, grade) => sum + grade, 0) / homeworkGrades.length
          ).toFixed(2)
        )
      : 0;

  const commonChallenges = collectCommonChallenges(signals);
  const learningProgress = deriveLearningProgress(signals);
  const engagementMetrics = deriveEngagementMetrics(signals);
  const conversationInsights = deriveConversationInsights(signals);
  const lastActivity = deriveLastActivity(signals) || now;

  let knowledgeScore: StudentProfile["knowledgeScore"] = "empty";
  if (homeworkGrades.length > 0 || totalQuestions > 0) {
    if (averageGrade >= 80 && commonChallenges.length <= 2) {
      knowledgeScore = "good";
    } else if (averageGrade >= 60 || totalQuestions >= 5) {
      knowledgeScore = "needs_attention";
    } else {
      knowledgeScore = "struggling";
    }
  }

  const riskFlags = [
    engagementMetrics.helpRequests >= 5 ? "Frequent help requests" : null,
    averageGrade > 0 && averageGrade < 60 ? "Low average grade" : null,
    commonChallenges.length >= 3 ? "Multiple recurring challenge areas" : null,
    conversationInsights.learningTrend === "declining"
      ? "Declining conversation engagement trend"
      : null,
  ].filter((value): value is string => Boolean(value));

  const riskLevel: StudentProfile["riskFactors"]["riskLevel"] =
    averageGrade > 0 && averageGrade < 40
      ? "high"
      : riskFlags.length >= 2
        ? "medium"
        : "low";

  const evidenceComputedAt = new Date();
  const evidence = {
    rawSignalAggregation: buildEvidenceEntry(
      evidenceComputedAt,
      [
        "chat_sessions",
        "chat_messages",
        "submissions",
        "conversation_summaries",
        "student_activities",
      ],
      {
        sourceIdentifiers: signals.sourceIdentifiers,
        counts: {
          chatSessions: signals.chatSessions.length,
          chatMessages: signals.chatMessages.length,
          homeworkSubmissions: signals.homeworkSubmissions.length,
          conversationSummaries: signals.conversationSummaries.length,
          studentActivities: signals.studentActivities.length,
        },
      },
      signals.chatMessages.length + signals.homeworkSubmissions.length > 0 ? 0.92 : 0.35
    ),
    knowledgeScore: buildEvidenceEntry(
      evidenceComputedAt,
      ["submissions", "chat_messages", "student_activities"],
      {
        averageGrade,
        totalQuestions,
        recurringChallenges: commonChallenges,
      },
      homeworkGrades.length > 0 ? 0.84 : totalQuestions > 0 ? 0.62 : 0.28
    ),
    learningProgress: buildEvidenceEntry(
      evidenceComputedAt,
      ["conversation_summaries", "submissions"],
      learningProgress,
      signals.conversationSummaries.length + signals.homeworkSubmissions.length > 0 ? 0.76 : 0.3
    ),
    engagementMetrics: buildEvidenceEntry(
      evidenceComputedAt,
      ["chat_sessions", "chat_messages", "student_activities"],
      engagementMetrics,
      signals.chatSessions.length > 0 || signals.studentActivities.length > 0 ? 0.88 : 0.32
    ),
    riskFactors: buildEvidenceEntry(
      evidenceComputedAt,
      ["submissions", "conversation_summaries", "student_activities"],
      {
        riskFlags,
        riskLevel,
      },
      riskFlags.length > 0 ? 0.78 : 0.45
    ),
    conversationInsights: buildEvidenceEntry(
      evidenceComputedAt,
      ["conversation_summaries", "chat_messages"],
      conversationInsights as unknown as Record<string, unknown>,
      signals.conversationSummaries.length > 0 ? 0.74 : 0.4
    ),
    profileSnapshot: buildEvidenceEntry(
      evidenceComputedAt,
      ["users"],
      {
        canonicalUserId: signals.canonicalUserId,
        email: signals.email,
        userName: signals.userName,
        lastActivity,
      },
      0.98
    ),
  };

  return {
    lastActivity,
    totalQuestions,
    correctAnswers,
    homeworkSubmissions: signals.homeworkSubmissions.length,
    averageGrade,
    commonChallenges,
    knowledgeScore,
    learningProgress,
    engagementMetrics,
    riskFactors: {
      isAtRisk: riskLevel !== "low",
      riskLevel,
      riskFactors: riskFlags,
      lastAssessment: evidenceComputedAt,
    },
    conversationInsights,
    evidence,
  };
}

export async function persistProfileSnapshot(
  db: Db,
  signals: RawStudentSignals,
  derivedState: DerivedLearnerState,
  existingProfile: StudentProfile | null
) {
  const now = new Date();

  const update: Record<string, any> = {
    $set: {
      userId: signals.canonicalUserId,
      name: signals.userName || signals.email?.split("@")[0] || "ללא שם",
      email: signals.email,
      knowledgeScore: derivedState.knowledgeScore,
      lastActivity: derivedState.lastActivity,
      totalQuestions: derivedState.totalQuestions,
      correctAnswers: derivedState.correctAnswers,
      homeworkSubmissions: derivedState.homeworkSubmissions,
      averageGrade: derivedState.averageGrade,
      commonChallenges: derivedState.commonChallenges,
      learningProgress: derivedState.learningProgress,
      engagementMetrics: derivedState.engagementMetrics,
      riskFactors: derivedState.riskFactors,
      conversationInsights: derivedState.conversationInsights,
      evidence: {
        ...(existingProfile?.evidence ?? {}),
        ...derivedState.evidence,
      },
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt: now,
      issueCount: existingProfile?.issueCount ?? 0,
      issueHistory: existingProfile?.issueHistory ?? [],
      lastIssueUpdate: existingProfile?.lastIssueUpdate ?? now,
      topicMastery: existingProfile?.topicMastery ?? [],
      adminOversight: existingProfile?.adminOversight ?? {
        actions: [],
        confirmedWeaknesses: [],
        dismissedSignals: [],
        interventions: [],
        goalMarkers: [],
      },
    },
  };

  if (!existingProfile || existingProfile.knowledgeScore !== derivedState.knowledgeScore) {
    update.$push = {
      knowledgeScoreHistory: {
        score: derivedState.knowledgeScore,
        updatedAt: now,
        reason: "Recalculated from aggregated learner signals",
        updatedBy: "system",
      },
    };
  }

  await db
    .collection(COLLECTIONS.STUDENT_PROFILES)
    .updateOne({ userId: signals.canonicalUserId }, update, { upsert: true });
}

function collectCommonChallenges(signals: RawStudentSignals): string[] {
  const challengeCounts = new Map<string, number>();

  signals.conversationSummaries.forEach((summary) => {
    (summary.learningIndicators?.challengeAreas || []).forEach((challenge: string) => {
      challengeCounts.set(challenge, (challengeCounts.get(challenge) || 0) + 1);
    });
  });

  signals.studentActivities.forEach((activity) => {
    (activity.activityData?.errors || []).forEach((challenge: string) => {
      challengeCounts.set(challenge, (challengeCounts.get(challenge) || 0) + 1);
    });
  });

  return Array.from(challengeCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([challenge]) => challenge);
}

function deriveLearningProgress(
  signals: RawStudentSignals
): StudentProfile["learningProgress"] {
  const progress = {
    sqlBasics: 0,
    joins: 0,
    aggregations: 0,
    subqueries: 0,
    advancedQueries: 0,
  };

  const topicTexts = [
    ...signals.conversationSummaries.flatMap((summary) => summary.keyTopics || []),
    ...collectCommonChallenges(signals),
  ].map((value) => String(value).toLowerCase());

  topicTexts.forEach((topicText) => {
    for (const [field, keywords] of Object.entries(PROGRESS_TOPICS) as Array<
      [keyof StudentProfile["learningProgress"], readonly string[]]
    >) {
      if (keywords.some((keyword) => topicText.includes(keyword))) {
        progress[field] = Math.min(100, progress[field] + 20);
      }
    }
  });

  return progress;
}

function deriveEngagementMetrics(
  signals: RawStudentSignals
): StudentProfile["engagementMetrics"] {
  const helpRequests = signals.studentActivities.filter(
    (activity) =>
      activity.activityType === "help_request" || activity.activityData?.helpRequested === true
  ).length;

  const sessionDurations = signals.chatSessions
    .map((session) => {
      const sessionMessages = signals.chatMessages
        .filter((message) => message.chatId?.toString() === session._id?.toString())
        .sort(
          (left, right) =>
            new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime()
        );

      if (sessionMessages.length < 2) {
        return 0;
      }

      const startedAt = new Date(sessionMessages[0]?.timestamp || 0).getTime();
      const endedAt = new Date(
        sessionMessages[sessionMessages.length - 1]?.timestamp || 0
      ).getTime();

      if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
        return 0;
      }

      return Math.max(0, Math.round((endedAt - startedAt) / (1000 * 60)));
    })
    .filter((duration) => duration > 0);

  const averageSessionDuration = sessionDurations.length
    ? Number(
        (
          sessionDurations.reduce((sum, duration) => sum + duration, 0) /
          sessionDurations.length
        ).toFixed(2)
      )
    : 0;

  const selfCorrections = signals.studentActivities.filter(
    (activity) => activity.activityType === "practice" && activity.activityData?.corrected
  ).length;

  return {
    chatSessions: signals.chatSessions.length,
    averageSessionDuration,
    helpRequests,
    selfCorrections,
  };
}

function deriveConversationInsights(
  signals: RawStudentSignals
): StudentProfile["conversationInsights"] {
  const commonTopics = new Map<string, number>();

  signals.conversationSummaries.forEach((summary) => {
    (summary.keyTopics || []).forEach((topic: string) => {
      commonTopics.set(topic, (commonTopics.get(topic) || 0) + 1);
    });
  });

  const sortedTopics = Array.from(commonTopics.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  const challengeAreas = collectCommonChallenges(signals);
  const averageSessionDuration = deriveEngagementMetrics(signals).averageSessionDuration;
  const overallEngagement: StudentProfile["conversationInsights"]["overallEngagement"] =
    signals.chatSessions.length >= 8
      ? "high"
      : signals.chatSessions.length >= 3
        ? "medium"
        : "low";

  const learningTrend: StudentProfile["conversationInsights"]["learningTrend"] =
    challengeAreas.length >= 3 ? "declining" : signals.conversationSummaries.length > 0 ? "stable" : "improving";

  return {
    totalSessions: signals.chatSessions.length,
    averageSessionDuration,
    mostCommonTopics: sortedTopics,
    learningTrend,
    commonChallenges: challengeAreas,
    overallEngagement,
    lastAnalysisDate: deriveLastActivity(signals) || new Date(),
  };
}

function deriveLastActivity(signals: RawStudentSignals): Date | null {
  const candidates = [
    ...signals.chatMessages.map((message) => message.timestamp),
    ...signals.homeworkSubmissions.map((submission) => submission.updatedAt || submission.createdAt),
    ...signals.conversationSummaries.map((summary) => summary.createdAt),
    ...signals.studentActivities.map((activity) => activity.timestamp),
  ]
    .map((value) => new Date(value || 0))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  return candidates[0] ?? null;
}
