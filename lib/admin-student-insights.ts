import { COLLECTIONS, connectToDatabase } from "@/lib/database";
import { getFreshnessLabel, getFreshnessScore } from "@/lib/freshness";
import type { AnalyticsEventModel, AnalysisResultModel, QuestionAnalyticsModel } from "@/lib/models";
import {
  getStudentPersonalizationBundle,
  type RecentSubmissionAttempt,
  type StudentMisconceptionSignal,
} from "@/lib/personalization";
import { getStudentProfile, type StudentProfile, type StudentIssueRecord } from "@/lib/student-profiles";

type RecommendationOutcome = "helpful" | "not_helpful" | "pending";

export type AdminStudentEvidenceBundle = {
  profile: StudentProfile;
  pedagogicalSummary: {
    headline: string;
    rationale: string;
    topWeakSkill: string | null;
    confidence: number;
    freshnessLabel: string;
  };
  evidenceConsole: {
    weakSkills: Array<{
      topic: string;
      label: string;
      mastery: number;
      confidence: number;
      freshness: number;
      freshnessLabel: string;
      lastEvidenceTime: string | null;
      evidenceSummary: string[];
    }>;
    recentFailedAttempts: Array<{
      questionId: string;
      homeworkTitle: string | null;
      attempts: number;
      lastTriedAt: string | null;
      failureTags: string[];
      misconceptions: StudentMisconceptionSignal[];
      hintBurden: string;
    }>;
    hintUsagePatterns: {
      totalShowAnswerClicks: number;
      averageTimeToFirstHintMs: number | null;
      averageAttemptsBeforeHint: number | null;
      mostSupportedQuestions: Array<{
        questionId: string;
        showAnswerClicks: number;
        attempts: number;
      }>;
    };
    chatMisconceptions: Array<{
      label: string;
      studentExplanation: string;
      confidence: number;
      topics: string[];
      sources: string[];
    }>;
    recommendationHistory: Array<{
      recommendationId: string;
      recommendationType: string | null;
      weakSkill: string | null;
      misconception: string | null;
      shownAt: string | null;
      lastEventAt: string | null;
      feedbackHistory: string[];
      outcome: RecommendationOutcome;
    }>;
    issueDetections: Array<{
      issueId: string;
      description: string;
      severity: StudentIssueRecord["severity"];
      confidence: number;
      freshnessLabel: string;
      source: string | null;
      status: "open" | "resolved";
    }>;
    fieldTraceability: Array<{
      field: string;
      computedAt: string | null;
      confidence: number | null;
      freshnessLabel: string;
      sources: string[];
      evidencePreview: string[];
    }>;
  };
};

function formatHintBurden(attempt: RecentSubmissionAttempt) {
  if (attempt.supportSignals.showAnswerClicks <= 0) {
    return "No hint reliance recorded.";
  }

  if (attempt.supportSignals.timeToFirstShowAnswerMs === null) {
    return `${attempt.supportSignals.showAnswerClicks} hint opens recorded.`;
  }

  const minutes = Math.round(attempt.supportSignals.timeToFirstShowAnswerMs / 60000);
  return `${attempt.supportSignals.showAnswerClicks} hint opens, first after about ${minutes} minutes.`;
}

function buildRecommendationHistory(events: AnalyticsEventModel[]) {
  const grouped = new Map<string, AdminStudentEvidenceBundle["evidenceConsole"]["recommendationHistory"][number]>();

  events
    .slice()
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .forEach((event) => {
      const recommendationId =
        typeof event.metadata?.recommendationId === "string"
          ? event.metadata.recommendationId
          : null;
      if (!recommendationId) {
        return;
      }

      const feedback =
        typeof event.metadata?.feedback === "string" ? event.metadata.feedback : null;
      const existing =
        grouped.get(recommendationId) ??
        {
          recommendationId,
          recommendationType:
            typeof event.metadata?.recommendationType === "string"
              ? event.metadata.recommendationType
              : null,
          weakSkill:
            typeof event.metadata?.weakSkill === "string" ? event.metadata.weakSkill : null,
          misconception:
            typeof event.metadata?.misconception === "string"
              ? event.metadata.misconception
              : null,
          shownAt: null,
          lastEventAt: null,
          feedbackHistory: [],
          outcome: "pending" as RecommendationOutcome,
        };

      if (event.type === "runner.personalization_shown" && !existing.shownAt) {
        existing.shownAt = event.createdAt;
      }

      if (feedback) {
        existing.feedbackHistory.push(feedback);
      }

      if (event.type === "runner.personalization_accepted" || feedback === "helpful") {
        existing.outcome = "helpful";
      } else if (["not_relevant", "too_easy", "too_hard"].includes(feedback || "")) {
        existing.outcome = "not_helpful";
      }

      existing.lastEventAt = event.createdAt;
      grouped.set(recommendationId, existing);
    });

  return Array.from(grouped.values())
    .sort((left, right) => new Date(right.lastEventAt || 0).getTime() - new Date(left.lastEventAt || 0).getTime())
    .slice(0, 6);
}

function buildHintUsagePatterns(entries: QuestionAnalyticsModel[]) {
  const rows = entries.filter((entry) => (entry.metrics.showAnswerClicks ?? 0) > 0);
  const totalShowAnswerClicks = rows.reduce(
    (sum, entry) => sum + (entry.metrics.showAnswerClicks ?? 0),
    0
  );
  const timeSamples = rows
    .map((entry) => entry.metrics.timeToFirstShowAnswer)
    .filter((value): value is number => typeof value === "number");
  const attemptSamples = rows
    .map((entry) => entry.metrics.attempts)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    totalShowAnswerClicks,
    averageTimeToFirstHintMs: timeSamples.length
      ? Math.round(timeSamples.reduce((sum, value) => sum + value, 0) / timeSamples.length)
      : null,
    averageAttemptsBeforeHint: attemptSamples.length
      ? Number((attemptSamples.reduce((sum, value) => sum + value, 0) / attemptSamples.length).toFixed(1))
      : null,
    mostSupportedQuestions: rows
      .slice()
      .sort(
        (left, right) => (right.metrics.showAnswerClicks ?? 0) - (left.metrics.showAnswerClicks ?? 0)
      )
      .slice(0, 4)
      .map((entry) => ({
        questionId: entry.questionId,
        showAnswerClicks: entry.metrics.showAnswerClicks ?? 0,
        attempts: entry.metrics.attempts ?? 0,
      })),
  };
}

function buildChatMisconceptions(
  analyses: AnalysisResultModel[],
  attempts: RecentSubmissionAttempt[]
) {
  const fromAnalyses = analyses.flatMap((analysis) =>
    (analysis.results.failedQuestions || []).flatMap((failedQuestion) =>
      (failedQuestion.failureReasons || []).map((reason) => ({
        label: reason,
        studentExplanation: analysis.results.summary || reason,
        confidence: failedQuestion.confidence ?? analysis.confidence ?? 0.5,
        topics: failedQuestion.topicAreas || [],
        sources: ["ai_analysis"],
      }))
    )
  );

  const fromAttempts = attempts.flatMap((attempt) =>
    attempt.misconceptions.map((misconception) => ({
      label: misconception.label,
      studentExplanation: misconception.studentExplanation,
      confidence: misconception.confidence,
      topics: misconception.topics,
      sources: ["runner_attempts"],
    }))
  );

  type ChatMisconceptionEntry = (typeof fromAttempts)[number];
  const grouped = new Map<string, ChatMisconceptionEntry>();
  [...fromAnalyses, ...fromAttempts].forEach((item) => {
    const key = item.label.toLowerCase();
    const existing = grouped.get(key);
    if (!existing || item.confidence > existing.confidence) {
      grouped.set(key, item);
    }
  });

  return Array.from(grouped.values())
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 6);
}

function buildFieldTraceability(profile: StudentProfile) {
  return Object.entries(profile.evidence ?? {})
    .map(([field, entry]) => ({
      field,
      computedAt: entry.computedAt ? new Date(entry.computedAt).toISOString() : null,
      confidence: typeof entry.confidence === "number" ? entry.confidence : null,
      freshnessLabel:
        entry.freshnessLabel ??
        getFreshnessLabel(
          typeof entry.freshnessScore === "number"
            ? entry.freshnessScore
            : getFreshnessScore(entry.computedAt)
        ),
      sources: entry.sources ?? [],
      evidencePreview: Object.entries(entry.evidence ?? {})
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`),
    }))
    .sort((left, right) => new Date(right.computedAt || 0).getTime() - new Date(left.computedAt || 0).getTime());
}

function buildIssueDetections(profile: StudentProfile) {
  return (profile.issueHistory ?? [])
    .slice()
    .sort((left, right) => new Date(right.detectedAt || 0).getTime() - new Date(left.detectedAt || 0).getTime())
    .slice(0, 6)
    .map((issue) => {
      const status: "open" | "resolved" = issue.resolvedAt ? "resolved" : "open";
      return {
        issueId: issue.issueId,
        description: issue.description,
        severity: issue.severity,
        confidence:
          typeof issue.confidence === "number"
            ? issue.confidence
            : issue.severity === "high"
              ? 0.85
              : issue.severity === "medium"
                ? 0.7
                : 0.55,
        freshnessLabel:
          issue.freshnessLabel ??
          getFreshnessLabel(
            typeof issue.freshnessScore === "number"
              ? issue.freshnessScore
              : getFreshnessScore(issue.detectedAt)
          ),
        source: issue.source ?? null,
        status,
      };
    });
}

export async function getAdminStudentEvidenceBundle(studentId: string): Promise<AdminStudentEvidenceBundle | null> {
  const profile = await getStudentProfile(studentId);
  if (!profile) {
    return null;
  }

  const bundle = await getStudentPersonalizationBundle({ studentId: profile.userId });
  const { db } = await connectToDatabase();

  const [analyticsEvents, analyses, questionAnalytics] = await Promise.all([
    db
      .collection<AnalyticsEventModel>(COLLECTIONS.ANALYTICS)
      .find({
        actorId: profile.userId,
        type: {
          $in: [
            "runner.personalization_shown",
            "runner.personalization_accepted",
            "runner.personalization_feedback",
          ],
        },
      })
      .sort({ createdAt: -1 })
      .limit(40)
      .toArray(),
    db
      .collection<AnalysisResultModel>(COLLECTIONS.ANALYSIS_RESULTS)
      .find({ studentId: profile.userId, status: "completed" })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray(),
    db
      .collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS)
      .find({ studentId: profile.userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .toArray(),
  ]);

  const topWeakSkill = bundle.snapshot.weaknesses[0] ?? null;

  return {
    profile,
    pedagogicalSummary: {
      headline: topWeakSkill
        ? `${profile.name || profile.email || "Student"} is currently weakest in ${topWeakSkill.label}.`
        : `${profile.name || profile.email || "Student"} needs a fresh calibration before stronger claims are made.`,
      rationale: topWeakSkill
        ? topWeakSkill.reasons[0] ??
          `Recent evidence shows low mastery with ${Math.round(topWeakSkill.confidence * 100)}% confidence.`
        : "The learner model does not yet have enough measured evidence to rank a precise weakness.",
      topWeakSkill: topWeakSkill?.label ?? null,
      confidence: topWeakSkill?.confidence ?? bundle.recommendation.primary.confidence,
      freshnessLabel: topWeakSkill?.freshnessLabel ?? bundle.recommendation.primary.freshnessLabel,
    },
    evidenceConsole: {
      weakSkills: bundle.snapshot.topicMastery
        .filter((record) => record.status === "measured")
        .slice(0, 5)
        .map((record) => ({
          topic: record.topic,
          label: record.label,
          mastery: record.estimatedMastery,
          confidence: record.confidence,
          freshness:
            record.freshnessScore ?? getFreshnessScore(record.lastEvidenceTime),
          freshnessLabel:
            record.freshnessLabel ??
            getFreshnessLabel(record.freshnessScore ?? getFreshnessScore(record.lastEvidenceTime)),
          lastEvidenceTime: record.lastEvidenceTime,
          evidenceSummary: record.evidenceSummary,
        })),
      recentFailedAttempts: bundle.recentAttempts.attempts.slice(0, 5).map((attempt) => ({
        questionId: attempt.questionId,
        homeworkTitle: attempt.homeworkTitle,
        attempts: attempt.attempts,
        lastTriedAt: attempt.lastTriedAt,
        failureTags: attempt.failureTags,
        misconceptions: attempt.misconceptions,
        hintBurden: formatHintBurden(attempt),
      })),
      hintUsagePatterns: buildHintUsagePatterns(questionAnalytics),
      chatMisconceptions: buildChatMisconceptions(analyses, bundle.recentAttempts.attempts),
      recommendationHistory: buildRecommendationHistory(analyticsEvents),
      issueDetections: buildIssueDetections(profile),
      fieldTraceability: buildFieldTraceability(profile),
    },
  };
}
