import { randomUUID } from "crypto";

import type { LearningQuiz, LearningQuizQuestion, LearningQuizResult } from "@/lib/learning-quizzes";
import {
  createLearningQuiz,
  getLearningQuizResultsForUser,
  getLearningQuizzesByIds,
} from "@/lib/learning-quizzes";
import { getAnalysisService } from "@/lib/analysis-service";
import type { AnalysisResult } from "@/lib/ai-analysis";
import { COLLECTIONS, connectToDatabase, executeWithRetry } from "@/lib/database";
import { getHomeworkAvailabilityInfo } from "@/lib/deadline-utils";
import { getFreshnessLabel, getFreshnessScore, type FreshnessLabel } from "@/lib/freshness";
import { getHomeworkSetById } from "@/lib/homework";
import type { QuestionAnalyticsModel, SubmissionModel } from "@/lib/models";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import {
  buildLearnerIdentifierQuery,
  resolveLearnerIdentity,
} from "@/lib/learner-identity";
import type { StudentProfile } from "@/lib/student-profiles";
import {
  getStudentProfile as getResolvedStudentProfile,
} from "@/lib/student-profiles";
import {
  listStudentPreferences,
  STUDENT_PREFERENCE_DEFINITIONS,
  type StudentPreference,
} from "@/lib/student-preferences";
import type { HomeworkSet, Question } from "@/app/homework/types";
import {
  LEARNER_TOPICS,
  getLearnerTopicLabel,
  inferLearnerTopicsFromText,
  inferPrimaryLearnerTopic,
  type LearnerTopic as CanonicalTopic,
  type LearnerTrend,
  type LearnerWeaknessKind,
  type TopicMasteryRecord,
} from "@/lib/learner-model";
import {
  SQL_MISCONCEPTION_DEFINITIONS,
  getSqlMisconceptionDefinition,
  inferSqlMisconceptions,
  normalizeSqlMisconceptionCategory,
  summarizeMisconceptionForStudent,
  type SqlMisconceptionCategory,
  type SqlMisconceptionMatch,
} from "@/lib/sql-misconceptions";

type TopicSignalKind = "strength" | "weakness";

export type TopicSignal = {
  topic: CanonicalTopic;
  label: string;
  kind: TopicSignalKind;
  score: number;
  confidence: number;
  freshness: number;
  freshnessLabel: FreshnessLabel;
  evidenceCount: number;
  trend: LearnerTrend;
  lastEvidenceAt: string | null;
  strongestErrorTypes: string[];
  weaknessKinds: LearnerWeaknessKind[];
  status: "measured" | "insufficient_evidence";
  reasons: string[];
};

export type StudentTopicMasteryRecord = Omit<TopicMasteryRecord, "lastEvidenceTime"> & {
  lastEvidenceTime: string | null;
};

export type RecommendationTrace = {
  confidence: number;
  freshness: number;
  freshnessLabel: FreshnessLabel;
  lastUpdatedAt: string | null;
  basedOn: string[];
  evidenceSummary: string[];
};

export type StudentMisconceptionSignal = {
  category: SqlMisconceptionCategory;
  label: string;
  studentLabel: string;
  studentExplanation: string;
  confidence: number;
  topics: string[];
  reasons: string[];
};

export type StudentProgressSnapshot = {
  studentId: string;
  generatedAt: string;
  knowledgeScore: StudentProfile["knowledgeScore"] | "unknown";
  recentTrend: StudentProfile["conversationInsights"]["learningTrend"] | "unknown";
  topicMastery: StudentTopicMasteryRecord[];
  strengths: TopicSignal[];
  weaknesses: TopicSignal[];
  quizSummary: {
    totalAttempts: number;
    bestScore: number | null;
    lastScore: number | null;
    lastCompletedAt: string | null;
    averageScore: number | null;
    topicsToRevisit: string[];
  };
  engagementSummary: {
    lastActivityAt: string | null;
    chatSessions: number;
    helpRequests: number;
    homeworkSubmissions: number;
  };
  riskSummary: {
    isAtRisk: boolean;
    riskLevel: "low" | "medium" | "high" | "unknown";
    reasons: string[];
  };
  preferenceSummary: {
    preferredLanguage: string | null;
    preferredExplanationDepth: string | null;
    explanationStyle: string | null;
    exampleDensity: string | null;
    stepByStepTolerance: string | null;
    confidenceLevel: string | null;
    pacePreference: string | null;
    desiredChallengeLevel: string | null;
    learningGoal: string | null;
    currentStudyGoal: string | null;
    preferredHintStyle: string | null;
    preferredCorrectionStyle: string | null;
    accessibilityNeeds: string | null;
    examPrepGoals: string | null;
    repeatedWeaknesses: string[];
  };
};

export type RecentSubmissionAttempt = {
  submissionId: string;
  homeworkSetId: string;
  homeworkTitle: string | null;
  questionId: string;
  questionPrompt: string | null;
  studentAnswerSql: string | null;
  attempts: number;
  lastOutcome: "passed" | "needs_work" | "ungraded";
  lastScore: number | null;
  lastTriedAt: string | null;
  failureTags: string[];
  misconceptions: StudentMisconceptionSignal[];
  supportSignals: {
    showAnswerClicks: number;
    timeSpentMs: number | null;
    timeToFirstShowAnswerMs: number | null;
  };
};

export type RecentSubmissionAttemptSummary = {
  studentId: string;
  generatedAt: string;
  attempts: RecentSubmissionAttempt[];
  repeatedMistakeThemes: string[];
};

export type DeadlineAndScheduleContext = {
  studentId: string;
  generatedAt: string;
  currentHomework: {
    homeworkSetId: string;
    title: string;
    availabilityState: string;
    availabilityMessage: string;
    dueAt: string | null;
    effectiveAvailableUntil: string | null;
  } | null;
  sameCourseDeadlines: Array<{
    homeworkSetId: string;
    title: string;
    availabilityState: string;
    effectiveAvailableUntil: string | null;
  }>;
};

export type RecommendationAction =
  | {
      type: "focus_question";
      label: string;
      homeworkSetId: string;
      questionId: string;
    }
  | {
      type: "open_personalized_quiz";
      label: string;
      homeworkSetId: string | null;
      themes: string[];
    }
  | {
      type: "review_topic";
      label: string;
      topic: string;
    }
  | {
      type: "request_hint";
      label: string;
      homeworkSetId: string;
      questionId: string;
    };

export type LearningStepRecommendation = {
  id: string;
  type: "retry_question" | "personalized_quiz" | "review_topic" | "request_hint" | "calibration";
  title: string;
  rationale: string;
  weakSkill: string | null;
  misconception: StudentMisconceptionSignal | null;
  estimatedEffort: string;
  expectedPayoff: string;
  urgency: "low" | "medium" | "high";
  score: number;
  confidence: number;
  freshness: number;
  freshnessLabel: FreshnessLabel;
  lastUpdatedAt: string | null;
  basedOn: string[];
  evidenceSummary: string[];
  action: RecommendationAction;
};

export type RankedLearningStepRecommendation = {
  studentId: string;
  generatedAt: string;
  primary: LearningStepRecommendation;
  alternatives: LearningStepRecommendation[];
  reasoningSummary: string[];
};

export type PersonalizedQuizSource = {
  themes: string[];
  sourceQuestionIds: string[];
  sourceSubmissionIds: string[];
  homeworkSetId?: string | null;
};

export type StudentPersonalizationBundle = {
  snapshot: StudentProgressSnapshot;
  recentAttempts: RecentSubmissionAttemptSummary;
  deadlines: DeadlineAndScheduleContext;
  recommendation: RankedLearningStepRecommendation;
};

type QuizTemplate = {
  topic: CanonicalTopic;
  mcq: () => LearningQuizQuestion;
  sql: (homeworkSetId?: string | null, questionId?: string | null) => LearningQuizQuestion;
};

type ResolveStudentOptions = {
  studentId: string;
  homeworkSetId?: string | null;
  questionId?: string | null;
};

type AggregatedStudentSources = {
  studentId: string;
  homeworkSetId: string | null;
  questionId: string | null;
  userEmail: string | null;
  profile: StudentProfile | null;
  preferences: StudentPreference[];
  submissions: SubmissionModel[];
  questionAnalytics: QuestionAnalyticsModel[];
  quizResults: LearningQuizResult[];
  quizzesById: Map<string, LearningQuiz>;
  analyses: AnalysisResult[];
  currentHomework: HomeworkSet | null;
  sameCourseHomework: HomeworkSet[];
  questionsByHomeworkSet: Map<string, Question[]>;
  questionsById: Map<string, Question>;
};

type TopicEvidence = {
  topic: CanonicalTopic;
  polarity: "positive" | "negative";
  intensity: number;
  reliability: number;
  timestamp: Date | null;
  source: string;
  reason: string;
  weaknessKind?: LearnerWeaknessKind;
  errorType?: string | null;
};

const QUIZ_TEMPLATES: Record<CanonicalTopic, QuizTemplate> = {
  selection_projection: {
    topic: "selection_projection",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which clause should normally appear first in a basic SQL query?",
      choices: ["ORDER BY", "SELECT", "HAVING", "LIMIT"],
      correctIndex: 1,
      hint: "Think about the standard SQL clause order.",
      explanation: "A basic SQL query starts with SELECT before FROM, WHERE, and the remaining clauses.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns only the `name` and `email` columns from a table named `students`.",
      expectedSql: "SELECT name, email FROM students",
      hint: "You only need SELECT and FROM here.",
      explanation: "Project only the requested columns and read from the correct source table.",
    }),
  },
  joins: {
    topic: "joins",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Why is an ON condition required in most JOIN queries?",
      choices: [
        "To sort the rows",
        "To limit the result set to one row",
        "To connect matching rows from the related tables",
        "To rename the selected columns",
      ],
      correctIndex: 2,
      hint: "The ON clause defines the relationship.",
      explanation: "JOINs need a matching condition so SQL knows how rows from two tables relate.",
    }),
    sql: (homeworkSetId, questionId) => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns each order ID together with the matching customer name from `orders` and `customers`.",
      expectedSql:
        "SELECT orders.order_id, customers.customer_name FROM orders JOIN customers ON orders.customer_id = customers.customer_id",
      hint: "Start from the foreign key relationship between the tables.",
      explanation: "A correct JOIN matches `orders.customer_id` to `customers.customer_id` and selects one identifier from each table.",
      runnerConfig:
        homeworkSetId && questionId
          ? {
              setId: homeworkSetId,
              questionId,
            }
          : undefined,
    }),
  },
  filtering: {
    topic: "filtering",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which clause filters individual rows before grouping?",
      choices: ["HAVING", "WHERE", "ORDER BY", "UNION"],
      correctIndex: 1,
      hint: "Think about row-level filtering.",
      explanation: "WHERE filters raw rows before GROUP BY runs.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns all rows from `students` where `grade` is greater than 80.",
      expectedSql: "SELECT * FROM students WHERE grade > 80",
      hint: "Use WHERE with the filtering condition.",
      explanation: "WHERE keeps only rows that satisfy the row-level condition.",
    }),
  },
  grouping_aggregation: {
    topic: "grouping_aggregation",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "When should HAVING be used instead of WHERE?",
      choices: [
        "When filtering grouped results after aggregation",
        "When ordering by multiple columns",
        "When joining more than two tables",
        "When selecting all columns",
      ],
      correctIndex: 0,
      hint: "HAVING operates after GROUP BY.",
      explanation: "HAVING filters aggregated groups, while WHERE filters raw rows.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that counts how many orders each customer has in `orders`, grouped by `customer_id`.",
      expectedSql: "SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id",
      hint: "Use COUNT(*) and GROUP BY the grouping column.",
      explanation: "Aggregate functions must be combined with GROUP BY when you want one row per group.",
    }),
  },
  subqueries: {
    topic: "subqueries",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "What is a subquery?",
      choices: [
        "A query nested inside another query",
        "A query that always uses JOIN",
        "A query that cannot include WHERE",
        "A query used only for sorting",
      ],
      correctIndex: 0,
      hint: "Think about nested query structure.",
      explanation: "A subquery is a query that appears inside another SQL statement.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns students whose grade is above the average grade in `students`.",
      expectedSql: "SELECT * FROM students WHERE grade > (SELECT AVG(grade) FROM students)",
      hint: "Compute the average in a nested SELECT.",
      explanation: "The subquery returns the average grade, and the outer query compares each row against it.",
    }),
  },
  sorting: {
    topic: "sorting",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which clause controls the final sort order of query results?",
      choices: ["ORDER BY", "GROUP BY", "WHERE", "ON"],
      correctIndex: 0,
      hint: "Sorting is handled at the end of the query.",
      explanation: "ORDER BY sorts the final result set.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns all rows from `students` ordered by `grade` descending.",
      expectedSql: "SELECT * FROM students ORDER BY grade DESC",
      hint: "Use ORDER BY with DESC.",
      explanation: "ORDER BY applies to the final output and DESC reverses the default ascending sort.",
    }),
  },
  debugging: {
    topic: "debugging",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "What is the best first step when a SQL query returns a syntax error?",
      choices: [
        "Check clause order and punctuation carefully",
        "Add another JOIN",
        "Replace WHERE with HAVING",
        "Run the same query again without changes",
      ],
      correctIndex: 0,
      hint: "Syntax errors usually come from structure, keywords, or punctuation.",
      explanation: "Syntax debugging starts with the query structure and the exact location of the reported error.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Fix this idea into a valid SQL query: return all rows from `students`.",
      expectedSql: "SELECT * FROM students",
      hint: "A valid query still needs the SELECT keyword and FROM clause.",
      explanation: "Even the simplest query must follow valid SQL clause order.",
    }),
  },
  schema_comprehension: {
    topic: "schema_comprehension",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "What should you verify first before writing a query on a new dataset?",
      choices: [
        "The tables, key columns, and how they relate",
        "Only the ORDER BY clause",
        "Whether SQL keywords are uppercase",
        "The browser refresh button",
      ],
      correctIndex: 0,
      hint: "Good SQL starts with reading the schema correctly.",
      explanation: "Schema comprehension means knowing which tables and columns answer the question before writing the final query.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns each order together with the matching customer name, using the foreign-key relationship between `orders` and `customers`.",
      expectedSql:
        "SELECT orders.order_id, customers.customer_name FROM orders JOIN customers ON orders.customer_id = customers.customer_id",
      hint: "Start by identifying which key relates the two tables.",
      explanation: "Schema-reading errors usually disappear once the correct keys and table roles are identified.",
    }),
  },
  set_operations: {
    topic: "set_operations",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which SQL operator combines compatible result sets while removing duplicates by default?",
      choices: [
        "UNION",
        "JOIN",
        "HAVING",
        "LIMIT",
      ],
      correctIndex: 0,
      hint: "Think about combining two SELECT results.",
      explanation: "UNION stacks compatible SELECT results and removes duplicates unless UNION ALL is used.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns the union of customer IDs from `orders_2025` and `orders_2026`.",
      expectedSql: "SELECT customer_id FROM orders_2025 UNION SELECT customer_id FROM orders_2026",
      hint: "Use two compatible SELECT statements with a set operator.",
      explanation: "Set operations compare full result sets, not row-by-row joins.",
    }),
  },
  null_handling: {
    topic: "null_handling",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which expression correctly checks whether `manager_id` is missing?",
      choices: ["manager_id = NULL", "manager_id IS NULL", "manager_id == NULL", "manager_id IN NULL"],
      correctIndex: 1,
      hint: "NULL comparisons use a special predicate.",
      explanation: "SQL uses IS NULL and IS NOT NULL for NULL checks.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns employees whose `manager_id` is NULL.",
      expectedSql: "SELECT * FROM employees WHERE manager_id IS NULL",
      hint: "Use IS NULL instead of the equals operator.",
      explanation: "NULL handling mistakes usually come from using ordinary comparison operators.",
    }),
  },
  relational_algebra: {
    topic: "relational_algebra",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which relational algebra operator represents selection by condition?",
      choices: ["π", "σ", "ρ", "×"],
      correctIndex: 1,
      hint: "Selection filters rows by a predicate.",
      explanation: "The sigma operator represents selection in relational algebra.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Translate this idea into SQL: project only the `name` column from `students`.",
      expectedSql: "SELECT name FROM students",
      hint: "Projection in relational algebra matches selecting specific columns in SQL.",
      explanation: "Relational algebra fluency helps map abstract operators to concrete SQL clauses.",
    }),
  },
  exam_speed_fluency: {
    topic: "exam_speed_fluency",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "What usually improves SQL exam fluency fastest?",
      choices: [
        "Timed drills on familiar query patterns",
        "Reading the same prompt repeatedly without writing SQL",
        "Adding more tables to every query",
        "Memorizing only syntax errors",
      ],
      correctIndex: 0,
      hint: "Fluency is about fast retrieval under time pressure.",
      explanation: "Exam-speed fluency comes from repeated short drills on known patterns under light time pressure.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a fast two-clause query that returns all rows from `students` where `grade` is above 80.",
      expectedSql: "SELECT * FROM students WHERE grade > 80",
      hint: "Use the shortest correct pattern you know.",
      explanation: "Fluency work aims to retrieve the right structure quickly, not invent a new one.",
    }),
  },
};

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function parsePreferenceList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addSignal(
  store: Map<CanonicalTopic, TopicSignal>,
  signal: TopicSignal
) {
  const existing = store.get(signal.topic);
  if (!existing) {
    store.set(signal.topic, signal);
    return;
  }

  existing.score += signal.score;
  existing.confidence = Math.max(existing.confidence, signal.confidence);
  existing.freshness = Math.max(existing.freshness, signal.freshness);
  existing.freshnessLabel =
    existing.freshness >= signal.freshness ? existing.freshnessLabel : signal.freshnessLabel;
  existing.evidenceCount = Math.max(existing.evidenceCount, signal.evidenceCount);
  existing.lastEvidenceAt = existing.lastEvidenceAt || signal.lastEvidenceAt;
  if (signal.lastEvidenceAt && existing.lastEvidenceAt) {
    existing.lastEvidenceAt =
      new Date(signal.lastEvidenceAt).getTime() > new Date(existing.lastEvidenceAt).getTime()
        ? signal.lastEvidenceAt
        : existing.lastEvidenceAt;
  }
  existing.strongestErrorTypes = Array.from(
    new Set([...existing.strongestErrorTypes, ...signal.strongestErrorTypes])
  ).slice(0, 4);
  existing.weaknessKinds = Array.from(
    new Set([...existing.weaknessKinds, ...signal.weaknessKinds])
  );
  existing.status =
    existing.status === "measured" || signal.status === "measured"
      ? "measured"
      : "insufficient_evidence";
  if (signal.kind === "weakness" && existing.kind === "strength") {
    existing.kind = "weakness";
  }
  if (signal.reasons.length > 0) {
    existing.reasons = Array.from(new Set([...existing.reasons, ...signal.reasons])).slice(0, 4);
  }
}

function inferTopicFromText(value: string | null | undefined): CanonicalTopic | null {
  return inferPrimaryLearnerTopic(value);
}

function inferTopicsFromText(value: string | null | undefined): CanonicalTopic[] {
  return inferLearnerTopicsFromText(value);
}

function recencyDecay(timestamp: Date | null): number {
  if (!timestamp) {
    return 0.55;
  }

  const ageMs = Math.max(0, Date.now() - timestamp.getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 3) return 1;
  if (ageDays <= 10) return 0.9;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 60) return 0.55;
  return 0.35;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeNumber(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) {
    return 0;
  }

  return clamp01(value / max);
}

function extractErrorTypesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const errorTypes = new Set(
    inferSqlMisconceptions({ text }).map((match) => match.label.toLowerCase())
  );

  if (lower.includes("syntax") || lower.includes("parse") || lower.includes("unexpected token")) {
    errorTypes.add("syntax");
  }
  if (lower.includes("wrong result") || lower.includes("incorrect")) {
    errorTypes.add("logical mismatch");
  }

  return Array.from(errorTypes);
}

function extractFailureTagsFromText(text: string | null | undefined): string[] {
  if (!text) return [];

  const tags = new Set<string>();
  inferTopicsFromText(text).forEach((topic) => tags.add(getLearnerTopicLabel(topic)));
  extractErrorTypesFromText(text).forEach((tag) => tags.add(tag));

  const lower = text.toLowerCase();
  if (lower.includes("join")) tags.add("join");
  if (lower.includes("where") || lower.includes("filter")) tags.add("filtering");
  if (lower.includes("group") || lower.includes("having") || lower.includes("aggregate")) tags.add("grouping");
  if (lower.includes("subquery")) tags.add("subqueries");
  if (lower.includes("null")) tags.add("NULL");
  if (lower.includes("schema") || lower.includes("column") || lower.includes("table")) tags.add("schema");

  return Array.from(tags);
}

function resolveOutcome(score: number | null, points: number | undefined, failureTags: string[]) {
  if (score == null || points == null || points <= 0) {
    return failureTags.length > 0 ? "needs_work" : "ungraded";
  }

  return score >= points * 0.7 ? "passed" : "needs_work";
}

function formatWeaknessTheme(signal: TopicSignal): string {
  return signal.label;
}

function toStudentMisconceptionSignal(match: SqlMisconceptionMatch): StudentMisconceptionSignal {
  return {
    category: match.category,
    label: match.label,
    studentLabel: match.studentLabel,
    studentExplanation: match.studentExplanation,
    confidence: match.confidence,
    topics: match.topics.map((topic) => getLearnerTopicLabel(topic)),
    reasons: match.reasons,
  };
}

async function getAggregatedStudentSources(options: ResolveStudentOptions): Promise<AggregatedStudentSources> {
  const { db } = await connectToDatabase();
  const analysisService = await getAnalysisService();
  const identity = await resolveLearnerIdentity(
    options.studentId,
    "personalization.getAggregatedStudentSources"
  );
  const canonicalStudentId = identity.canonicalId;
  const userEmail = identity.email;

  const [profile, preferences, analyses, quizResults, currentHomework] = await Promise.all([
    getResolvedStudentProfile(canonicalStudentId),
    listStudentPreferences(canonicalStudentId),
    analysisService.getAnalysisResultsForStudent(
      canonicalStudentId,
      options.homeworkSetId ?? undefined
    ),
    getLearningQuizResultsForUser(canonicalStudentId),
    options.homeworkSetId ? getHomeworkSetById(options.homeworkSetId) : Promise.resolve(null),
  ]);

  const quizIds = Array.from(new Set(quizResults.map((result) => result.quizId)));
  const quizzes = await getLearningQuizzesByIds(quizIds);
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.quizId, quiz]));

  const submissions = await executeWithRetry(async (database) =>
    database
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .find(buildLearnerIdentifierQuery("studentId", identity))
      .sort({ updatedAt: -1, submittedAt: -1 })
      .limit(12)
      .toArray()
  );

  const questionAnalytics = await executeWithRetry(async (database) =>
    database
      .collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS)
      .find(buildLearnerIdentifierQuery("studentId", identity))
      .sort({ updatedAt: -1 })
      .limit(24)
      .toArray()
  );

  let sameCourseHomework: HomeworkSet[] = [];
  if (currentHomework?.courseId) {
    sameCourseHomework = await executeWithRetry(async (database) => {
      const rows = await database
        .collection(COLLECTIONS.HOMEWORK_SETS)
        .find({
          courseId: currentHomework.courseId,
          id: { $ne: currentHomework.id },
          visibility: { $ne: "archived" },
          entryMode: { $ne: "hidden" },
        })
        .sort({ availableUntil: 1, dueAt: 1 })
        .limit(6)
        .toArray();

      return rows.map((row) => ({
        id: row.id || row._id?.toString(),
        title: row.title,
        courseId: row.courseId,
        dueAt: row.dueAt,
        availableFrom: row.availableFrom,
        availableUntil: row.availableUntil || row.dueAt,
        published: row.published,
        entryMode: row.entryMode,
        homeworkType: row.homeworkType,
        datasetPolicy: row.datasetPolicy,
        questionOrder: row.questionOrder || [],
        visibility: row.visibility,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        overview: row.overview,
        selectedDatasetId: row.selectedDatasetId,
        backgroundStory: row.backgroundStory,
        dataStructureNotes: row.dataStructureNotes,
      }));
    });
  }

  const relevantHomeworkIds = Array.from(
    new Set(
      [
        options.homeworkSetId,
        ...submissions.map((submission) => submission.homeworkSetId),
      ].filter(Boolean)
    )
  ) as string[];

  const questionsByHomeworkSet = new Map<string, Question[]>();
  const questionsById = new Map<string, Question>();
  await Promise.all(
    relevantHomeworkIds.map(async (homeworkSetId) => {
      const questions = await getQuestionsByHomeworkSet(homeworkSetId);
      questionsByHomeworkSet.set(homeworkSetId, questions);
      questions.forEach((question) => questionsById.set(question.id, question));
    })
  );

  return {
    studentId: canonicalStudentId,
    homeworkSetId: options.homeworkSetId ?? null,
    questionId: options.questionId ?? null,
    userEmail,
    profile,
    preferences,
    submissions,
    questionAnalytics,
    quizResults,
    quizzesById,
    analyses,
    currentHomework,
    sameCourseHomework,
    questionsByHomeworkSet,
    questionsById,
  };
}

function addEvidence(
  store: Map<CanonicalTopic, TopicEvidence[]>,
  evidence: TopicEvidence
) {
  const list = store.get(evidence.topic) ?? [];
  list.push(evidence);
  store.set(evidence.topic, list);
}

function inferAttemptMisconceptions(input: {
  feedbackText?: string | null;
  sql?: string | null;
  questionPrompt?: string | null;
}): StudentMisconceptionSignal[] {
  return inferSqlMisconceptions({
    text: input.feedbackText,
    sql: input.sql,
    prompt: input.questionPrompt,
  }).map(toStudentMisconceptionSignal);
}

function mapLegacyProgressToTopicEvidence(
  sources: AggregatedStudentSources,
  store: Map<CanonicalTopic, TopicEvidence[]>
) {
  const progress = sources.profile?.learningProgress;
  if (!progress) {
    return;
  }

  const entries: Array<[CanonicalTopic, number]> = [
    ["selection_projection", progress.sqlBasics],
    ["joins", progress.joins],
    ["grouping_aggregation", progress.aggregations],
    ["subqueries", progress.subqueries],
    ["debugging", progress.advancedQueries],
  ];

  entries.forEach(([topic, score]) => {
    if (score <= 0) {
      return;
    }

    addEvidence(store, {
      topic,
      polarity: score >= 60 ? "positive" : "negative",
      intensity: clamp01(Math.abs(score - 50) / 50),
      reliability: 0.42,
      timestamp: sources.profile?.updatedAt ?? null,
      source: "legacy_learning_progress",
      reason:
        score >= 60
          ? `Legacy progress snapshot marks ${getLearnerTopicLabel(topic)} as relatively strong.`
          : `Legacy progress snapshot marks ${getLearnerTopicLabel(topic)} as relatively weak.`,
      weaknessKind: score >= 60 ? undefined : "concept",
    });
  });
}

function collectTopicEvidence(sources: AggregatedStudentSources) {
  const store = new Map<CanonicalTopic, TopicEvidence[]>();

  mapLegacyProgressToTopicEvidence(sources, store);

  (sources.profile?.topicMastery ?? []).forEach((record) => {
    addEvidence(store, {
      topic: record.topic,
      polarity: record.estimatedMastery >= 0.55 ? "positive" : "negative",
      intensity:
        record.estimatedMastery >= 0.55
          ? record.estimatedMastery
          : 1 - record.estimatedMastery,
      reliability: 0.58,
      timestamp: record.lastEvidenceTime ?? sources.profile?.updatedAt ?? null,
      source: "stored_topic_mastery",
      reason: `Stored learner model snapshot for ${record.label}.`,
      weaknessKind: record.estimatedMastery >= 0.55 ? undefined : record.weaknessKinds[0] ?? "concept",
      errorType: record.strongestErrorTypes[0] ?? null,
    });
  });

  (sources.profile?.commonChallenges ?? []).forEach((challenge) => {
    inferTopicsFromText(challenge).forEach((topic) => {
      addEvidence(store, {
        topic,
        polarity: "negative",
        intensity: 0.65,
        reliability: 0.45,
        timestamp: sources.profile?.updatedAt ?? null,
        source: "profile_common_challenges",
        reason: `Recurring challenge recorded in the profile: ${challenge}`,
        weaknessKind:
          topic === "schema_comprehension" ? "schema_reading" : "concept",
        errorType: extractErrorTypesFromText(challenge)[0] ?? null,
      });
    });
  });

  sources.preferences.forEach((preference) => {
    const topics = inferTopicsFromText(preference.value);
    if (!topics.length) {
      return;
    }

    const isWeaknessPreference =
      preference.key === "weak_topics_self_report" ||
      preference.key === "repeated_sql_weaknesses";

    const isConfidencePreference =
      preference.key === "self_confidence_level" &&
      preference.value.toLowerCase() === "low";

    topics.forEach((topic) => {
      addEvidence(store, {
        topic,
        polarity: isWeaknessPreference || isConfidencePreference ? "negative" : "positive",
        intensity: isConfidencePreference ? 0.45 : 0.55,
        reliability:
          preference.source === "student"
            ? 0.72
            : preference.source === "assistant"
              ? 0.56
              : 0.45,
        timestamp: preference.updatedAt ?? null,
        source: `preference:${preference.key}`,
        reason: `${STUDENT_PREFERENCE_DEFINITIONS[preference.key].label}: ${preference.value}`,
        weaknessKind: isConfidencePreference ? "confidence" : "concept",
      });
    });
  });

  sources.analyses.forEach((analysis) => {
    analysis.results?.topicMapping?.forEach((mapping) => {
      inferTopicsFromText([mapping.topic, ...(mapping.commonErrors || [])].join(" ")).forEach(
        (topic) => {
          addEvidence(store, {
            topic,
            polarity: mapping.successRate >= 0.75 ? "positive" : "negative",
            intensity:
              mapping.successRate >= 0.75
                ? clamp01(mapping.successRate)
                : clamp01(1 - mapping.successRate),
            reliability: 0.9,
            timestamp: analysis.metadata?.completedAt
              ? new Date(analysis.metadata.completedAt)
              : analysis.metadata?.createdAt
                ? new Date(analysis.metadata.createdAt)
                : null,
            source: "analysis_topic_mapping",
            reason:
              mapping.successRate >= 0.75
                ? `AI analysis reports strong performance in ${mapping.topic}.`
                : `AI analysis reports low success in ${mapping.topic}.`,
            weaknessKind:
              mapping.successRate >= 0.75
                ? undefined
                : topic === "schema_comprehension"
                  ? "schema_reading"
                  : "concept",
            errorType: mapping.commonErrors?.[0] ?? null,
          });
        }
      );
    });

    analysis.results?.failedQuestions?.forEach((failedQuestion) => {
      const failureText = [
        ...failedQuestion.topicAreas,
        ...failedQuestion.failureReasons,
        failedQuestion.questionPrompt,
      ].join(" ");

      const topics = inferTopicsFromText(failureText);
      const errorTypes = extractErrorTypesFromText(failureText);
      topics.forEach((topic) => {
        addEvidence(store, {
          topic,
          polarity: "negative",
          intensity: clamp01(failedQuestion.confidence || 0.75),
          reliability: 0.84,
          timestamp: analysis.metadata?.completedAt
            ? new Date(analysis.metadata.completedAt)
            : analysis.metadata?.createdAt
              ? new Date(analysis.metadata.createdAt)
              : null,
          source: "analysis_failed_question",
          reason: `AI analysis flagged a failed question in ${getLearnerTopicLabel(topic)}.`,
          weaknessKind:
            topic === "schema_comprehension"
              ? "schema_reading"
              : topic === "debugging"
                ? "debugging"
                : "concept",
          errorType: errorTypes[0] ?? null,
        });
      });
    });
  });

  sources.quizResults.forEach((result) => {
    const quiz = sources.quizzesById.get(result.quizId);
    const themeText = [
      ...(quiz?.personalization?.themes ?? []),
      quiz?.title,
    ]
      .filter(Boolean)
      .join(" ");

    const topics = inferTopicsFromText(themeText);
    if (!topics.length) {
      return;
    }

    topics.forEach((topic) => {
      addEvidence(store, {
        topic,
        polarity: result.score >= 80 ? "positive" : "negative",
        intensity:
          result.score >= 80
            ? clamp01(result.score / 100)
            : clamp01((100 - result.score) / 100),
        reliability: 0.82,
        timestamp: result.completedAt ? new Date(result.completedAt) : null,
        source: "quiz_result",
        reason:
          result.score >= 80
            ? `Focused quiz performance was strong for ${getLearnerTopicLabel(topic)}.`
            : `Focused quiz performance stayed weak for ${getLearnerTopicLabel(topic)}.`,
        weaknessKind: result.score >= 80 ? undefined : "concept",
      });
    });
  });

  const submissionLookup = new Map(
    sources.submissions.map((submission) => [submission.id, submission])
  );

  sources.questionAnalytics.forEach((entry) => {
    const question = sources.questionsById.get(entry.questionId);
    const submission = submissionLookup.get(entry.submissionId);
    const answer = submission?.answers?.[entry.questionId];
    const feedbackText = [
      answer?.feedback?.autoNotes,
      answer?.feedback?.instructorNotes,
      question?.prompt,
      question?.instructions,
      answer?.sql,
    ]
      .filter(Boolean)
      .join(" ");

    const timestamp = entry.updatedAt
      ? new Date(entry.updatedAt)
      : entry.metrics.lastActivityAt
        ? new Date(entry.metrics.lastActivityAt)
        : null;
    const topics = inferTopicsFromText(feedbackText);
    const errorTypes = extractErrorTypesFromText(feedbackText);
    const normalizedScore =
      typeof answer?.feedback?.score === "number" && typeof question?.points === "number"
        ? clamp01(answer.feedback.score / Math.max(question.points, 1))
        : null;
    const passed = normalizedScore !== null ? normalizedScore >= 0.7 : false;

    topics.forEach((topic) => {
      addEvidence(store, {
        topic,
        polarity: passed ? "positive" : "negative",
        intensity:
          normalizedScore === null
            ? 0.45
            : passed
              ? Math.max(0.35, normalizedScore)
              : Math.max(0.35, 1 - normalizedScore),
        reliability: 0.96,
        timestamp,
        source: "question_analytics",
        reason: passed
          ? `Recent attempt succeeded in ${getLearnerTopicLabel(topic)}.`
          : `Recent attempt struggled in ${getLearnerTopicLabel(topic)}.`,
        weaknessKind:
          passed
            ? undefined
            : topic === "schema_comprehension"
              ? "schema_reading"
              : topic === "debugging"
                ? "debugging"
                : "concept",
        errorType: errorTypes[0] ?? null,
      });
    });

    if ((entry.metrics.attempts || 0) >= 3 || (entry.metrics.timeSpent || 0) >= 12 * 60 * 1000) {
      const intensity = Math.max(
        normalizeNumber(entry.metrics.attempts || 0, 6),
        normalizeNumber(entry.metrics.timeSpent || 0, 20 * 60 * 1000)
      );
      const speedReason =
        passed && topics.length > 0
          ? "The student eventually solved the question, but only after a slow or repeated attempt pattern."
          : "Repeated attempts or long time-on-task suggest low exam-speed fluency.";

      addEvidence(store, {
        topic: "exam_speed_fluency",
        polarity: "negative",
        intensity: Math.max(0.35, intensity),
        reliability: 0.92,
        timestamp,
        source: "question_analytics_speed",
        reason: speedReason,
        weaknessKind: "speed",
      });

      topics.forEach((topic) => {
        addEvidence(store, {
          topic,
          polarity: "negative",
          intensity: Math.max(0.25, intensity * 0.8),
          reliability: 0.8,
          timestamp,
          source: "question_analytics_speed",
          reason: `Speed signals stayed weak while working on ${getLearnerTopicLabel(topic)}.`,
          weaknessKind: "speed",
        });
      });
    }

    if ((entry.metrics.showAnswerClicks || 0) > 0) {
      const confidenceIntensity = Math.max(
        0.25,
        normalizeNumber(entry.metrics.showAnswerClicks || 0, 3)
      );
      topics.forEach((topic) => {
        addEvidence(store, {
          topic,
          polarity: "negative",
          intensity: confidenceIntensity,
          reliability: 0.74,
          timestamp,
          source: "question_analytics_hint_usage",
          reason: `Hint usage suggests the student was not yet confident in ${getLearnerTopicLabel(topic)}.`,
          weaknessKind: "confidence",
        });
      });
    }

    if (
      errorTypes.includes("schema navigation") ||
      errorTypes.includes("alias confusion")
    ) {
      addEvidence(store, {
        topic: "schema_comprehension",
        polarity: "negative",
        intensity: 0.72,
        reliability: 0.9,
        timestamp,
        source: "question_analytics_schema",
        reason: "Table, column, alias, or schema navigation errors were detected.",
        weaknessKind: "schema_reading",
        errorType: errorTypes.find((item) =>
          item === "schema navigation" || item === "alias confusion"
        ) ?? null,
      });
    }

    if (errorTypes.includes("syntax") || errorTypes.includes("logical mismatch")) {
      addEvidence(store, {
        topic: "debugging",
        polarity: "negative",
        intensity: 0.6,
        reliability: 0.88,
        timestamp,
        source: "question_analytics_debugging",
        reason: "Recent feedback shows parser or result-debugging issues.",
        weaknessKind: "debugging",
        errorType: errorTypes[0] ?? null,
      });
    }
  });

  return store;
}

function buildTopicMasteryRecords(
  sources: AggregatedStudentSources
): TopicMasteryRecord[] {
  const evidenceStore = collectTopicEvidence(sources);

  return LEARNER_TOPICS.map((topic) => {
    const evidence = evidenceStore.get(topic) ?? [];
    const weightedEvidence = evidence.map((item) => {
      const weight = item.reliability * recencyDecay(item.timestamp) * item.intensity;
      return {
        ...item,
        weight,
        signedWeight: item.polarity === "positive" ? weight : -weight,
      };
    });
    const positiveWeight = weightedEvidence
      .filter((item) => item.polarity === "positive")
      .reduce((sum, item) => sum + item.weight, 0);
    const negativeWeight = weightedEvidence
      .filter((item) => item.polarity === "negative")
      .reduce((sum, item) => sum + item.weight, 0);
    const totalWeight = positiveWeight + negativeWeight;
    const sortedReasons = weightedEvidence
      .slice()
      .sort((left, right) => Math.abs(right.signedWeight) - Math.abs(left.signedWeight))
      .map((item) => item.reason);
    const lastEvidenceTime = weightedEvidence.reduce<Date | null>(
      (latest, item) => {
        if (!item.timestamp) {
          return latest;
        }
        if (!latest || item.timestamp.getTime() > latest.getTime()) {
          return item.timestamp;
        }
        return latest;
      },
      null
    );
    const recentScore = weightedEvidence
      .filter(
        (item) =>
          item.timestamp &&
          Date.now() - item.timestamp.getTime() <= 14 * 24 * 60 * 60 * 1000
      )
      .reduce((sum, item) => sum + item.signedWeight, 0);
    const olderScore = weightedEvidence
      .filter(
        (item) =>
          !item.timestamp ||
          Date.now() - item.timestamp.getTime() > 14 * 24 * 60 * 60 * 1000
      )
      .reduce((sum, item) => sum + item.signedWeight, 0);

    let trend: LearnerTrend = "unknown";
    if (totalWeight >= 0.5) {
      if (Math.abs(recentScore - olderScore) < 0.25) {
        trend = "stable";
      } else {
        trend = recentScore > olderScore ? "improving" : "declining";
      }
    }

    const strongestErrorTypes = Array.from(
      new Set(
        weightedEvidence
          .filter((item) => item.polarity === "negative")
          .map((item) => item.errorType)
          .filter((item): item is string => Boolean(item))
      )
    ).slice(0, 4);

    const weaknessKinds = Array.from(
      new Set(
        weightedEvidence
          .map((item) => item.weaknessKind)
          .filter((item): item is LearnerWeaknessKind => Boolean(item))
      )
    );

    const status: TopicMasteryRecord["status"] =
      totalWeight >= 0.45 ? "measured" : "insufficient_evidence";
    const freshnessScore = getFreshnessScore(lastEvidenceTime, {
      freshHours: 24 * 3,
      staleHours: 24 * 21,
    });

    return {
      topic,
      label: getLearnerTopicLabel(topic),
      estimatedMastery:
        status === "measured"
          ? clamp01((positiveWeight + 0.35) / (totalWeight + 0.7))
          : 0.5,
      confidence: clamp01(totalWeight / 3.2),
      evidenceCount: evidence.length,
      lastEvidenceTime,
      trend,
      strongestErrorTypes,
      weaknessKinds,
      status,
      evidenceSummary: Array.from(new Set(sortedReasons)).slice(0, 4),
      freshnessScore,
      freshnessLabel: getFreshnessLabel(freshnessScore),
    };
  }).sort((left, right) => left.estimatedMastery - right.estimatedMastery);
}

function buildTopicSignals(
  sources: AggregatedStudentSources
) {
  const topicMastery = buildTopicMasteryRecords(sources);
  const strengths = new Map<CanonicalTopic, TopicSignal>();
  const weaknesses = new Map<CanonicalTopic, TopicSignal>();

  topicMastery.forEach((record) => {
    if (record.status === "insufficient_evidence") {
      return;
    }

    const confidenceBoost = record.confidence * 3;
    if (record.estimatedMastery >= 0.68) {
      addSignal(strengths, {
        topic: record.topic,
        label: record.label,
        kind: "strength",
        score: Math.round(record.estimatedMastery * 10 + confidenceBoost),
        confidence: record.confidence,
        freshness: record.freshnessScore ?? getFreshnessScore(record.lastEvidenceTime),
        freshnessLabel:
          record.freshnessLabel ??
          getFreshnessLabel(record.freshnessScore ?? getFreshnessScore(record.lastEvidenceTime)),
        evidenceCount: record.evidenceCount,
        trend: record.trend,
        lastEvidenceAt: normalizeDate(record.lastEvidenceTime),
        strongestErrorTypes: record.strongestErrorTypes,
        weaknessKinds: record.weaknessKinds,
        status: record.status,
        reasons: record.evidenceSummary,
      });
    }

    if (record.estimatedMastery <= 0.58) {
      addSignal(weaknesses, {
        topic: record.topic,
        label: record.label,
        kind: "weakness",
        score: Math.round((1 - record.estimatedMastery) * 12 + confidenceBoost),
        confidence: record.confidence,
        freshness: record.freshnessScore ?? getFreshnessScore(record.lastEvidenceTime),
        freshnessLabel:
          record.freshnessLabel ??
          getFreshnessLabel(record.freshnessScore ?? getFreshnessScore(record.lastEvidenceTime)),
        evidenceCount: record.evidenceCount,
        trend: record.trend,
        lastEvidenceAt: normalizeDate(record.lastEvidenceTime),
        strongestErrorTypes: record.strongestErrorTypes,
        weaknessKinds: record.weaknessKinds,
        status: record.status,
        reasons: record.evidenceSummary,
      });
    }
  });

  return {
    topicMastery,
    strengths: Array.from(strengths.values()).sort((left, right) => right.score - left.score),
    weaknesses: Array.from(weaknesses.values()).sort((left, right) => right.score - left.score),
  };
}

function buildQuizSummary(sources: AggregatedStudentSources) {
  const scores = sources.quizResults.map((result) => result.score);
  const sorted = sources.quizResults
    .slice()
    .sort(
      (left, right) =>
        new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime()
    );

  const weakLabels = new Set<string>();
  sorted.forEach((result) => {
    if (result.score >= 80) return;
    const quiz = sources.quizzesById.get(result.quizId);
    if (!quiz) return;

    if (quiz.targetType === "personalized_review" && quiz.personalization?.themes?.length) {
      quiz.personalization.themes.forEach((theme) => weakLabels.add(theme));
      return;
    }

    if (quiz.targetType === "lecture" || quiz.targetType === "practice") {
      weakLabels.add(quiz.title);
    }
  });

  return {
    totalAttempts: scores.length,
    bestScore: scores.length ? Math.max(...scores) : null,
    lastScore: sorted[0]?.score ?? null,
    lastCompletedAt: normalizeDate(sorted[0]?.completedAt),
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    topicsToRevisit: Array.from(weakLabels).slice(0, 3),
  };
}

function getPreferenceMap(preferences: StudentPreference[]) {
  return new Map(preferences.map((preference) => [preference.key, preference.value]));
}

function getPreferenceValue(
  map: Map<string, string>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = map.get(key);
    if (value) {
      return value;
    }
  }

  return null;
}

function deriveKnowledgeScoreFromMastery(
  profile: StudentProfile | null,
  topicMastery: TopicMasteryRecord[]
): StudentProfile["knowledgeScore"] | "unknown" {
  const measured = topicMastery.filter((record) => record.status === "measured");
  if (!measured.length) {
    return profile?.knowledgeScore ?? "unknown";
  }

  const averageMastery =
    measured.reduce((sum, record) => sum + record.estimatedMastery * Math.max(record.confidence, 0.2), 0) /
    measured.reduce((sum, record) => sum + Math.max(record.confidence, 0.2), 0);
  const lowMasteryCount = measured.filter((record) => record.estimatedMastery < 0.45).length;

  if (averageMastery >= 0.72 && lowMasteryCount <= 1) {
    return "good";
  }
  if (averageMastery >= 0.46) {
    return "needs_attention";
  }
  return "struggling";
}

function toPublicTopicMastery(
  records: TopicMasteryRecord[]
): StudentTopicMasteryRecord[] {
  return records.map((record) => ({
    ...record,
    lastEvidenceTime: normalizeDate(record.lastEvidenceTime),
  }));
}

export function buildStudentProgressSnapshotFromSources(
  sources: AggregatedStudentSources
): StudentProgressSnapshot {
  const preferenceMap = getPreferenceMap(sources.preferences);
  const signals = buildTopicSignals(sources);
  const quizSummary = buildQuizSummary(sources);
  const repeatedWeaknesses = Array.from(
    new Set([
      ...parsePreferenceList(getPreferenceValue(preferenceMap, "weak_topics_self_report")),
      ...parsePreferenceList(getPreferenceValue(preferenceMap, "repeated_sql_weaknesses")),
    ])
  );

  return {
    studentId: sources.studentId,
    generatedAt: new Date().toISOString(),
    knowledgeScore: deriveKnowledgeScoreFromMastery(sources.profile, signals.topicMastery),
    recentTrend: sources.profile?.conversationInsights?.learningTrend ?? "unknown",
    topicMastery: toPublicTopicMastery(signals.topicMastery),
    strengths: signals.strengths.slice(0, 3),
    weaknesses: signals.weaknesses.slice(0, 4),
    quizSummary,
    engagementSummary: {
      lastActivityAt: normalizeDate(sources.profile?.lastActivity),
      chatSessions: sources.profile?.engagementMetrics?.chatSessions ?? 0,
      helpRequests: sources.profile?.engagementMetrics?.helpRequests ?? 0,
      homeworkSubmissions: sources.profile?.homeworkSubmissions ?? 0,
    },
    riskSummary: {
      isAtRisk: sources.profile?.riskFactors?.isAtRisk ?? false,
      riskLevel: sources.profile?.riskFactors?.riskLevel ?? "unknown",
      reasons: sources.profile?.riskFactors?.riskFactors ?? [],
    },
    preferenceSummary: {
      preferredLanguage: getPreferenceValue(preferenceMap, "preferred_language"),
      preferredExplanationDepth: getPreferenceValue(
        preferenceMap,
        "preferred_explanation_depth"
      ),
      explanationStyle: getPreferenceValue(preferenceMap, "explanation_style"),
      exampleDensity: getPreferenceValue(preferenceMap, "example_density"),
      stepByStepTolerance: getPreferenceValue(
        preferenceMap,
        "step_by_step_tolerance"
      ),
      confidenceLevel: getPreferenceValue(preferenceMap, "self_confidence_level"),
      pacePreference: getPreferenceValue(preferenceMap, "pace_preference"),
      desiredChallengeLevel: getPreferenceValue(
        preferenceMap,
        "desired_challenge_level"
      ),
      learningGoal: getPreferenceValue(
        preferenceMap,
        "learning_goal",
        "exam_prep_goals"
      ),
      currentStudyGoal: getPreferenceValue(preferenceMap, "current_study_goal"),
      preferredHintStyle: getPreferenceValue(preferenceMap, "preferred_hint_style"),
      preferredCorrectionStyle: getPreferenceValue(
        preferenceMap,
        "preferred_correction_style"
      ),
      accessibilityNeeds: getPreferenceValue(preferenceMap, "accessibility_needs"),
      examPrepGoals: getPreferenceValue(preferenceMap, "exam_prep_goals"),
      repeatedWeaknesses,
    },
  };
}

export function buildRecentSubmissionAttemptsFromSources(
  sources: AggregatedStudentSources
): RecentSubmissionAttemptSummary {
  const submissionLookup = new Map(
    sources.submissions.map((submission) => [
      submission.id,
      submission,
    ])
  );
  const homeworkTitleCache = new Map<string, string | null>();

  const attempts = sources.questionAnalytics
    .map<RecentSubmissionAttempt | null>((entry) => {
      const submission = submissionLookup.get(entry.submissionId);
      const answer = submission?.answers?.[entry.questionId];
      const question = sources.questionsById.get(entry.questionId);
      const feedbackText = [answer?.feedback?.autoNotes, answer?.feedback?.instructorNotes]
        .filter(Boolean)
        .join(" ");
      const failureTags = extractFailureTagsFromText(feedbackText);
      const misconceptions = inferAttemptMisconceptions({
        feedbackText,
        sql: answer?.sql,
        questionPrompt: [question?.prompt, question?.instructions].filter(Boolean).join(" "),
      });

      if (!homeworkTitleCache.has(entry.homeworkSetId)) {
        const fallbackHomework =
          entry.homeworkSetId === sources.currentHomework?.id
            ? sources.currentHomework?.title ?? null
            : null;
        homeworkTitleCache.set(entry.homeworkSetId, fallbackHomework);
      }

      return {
        submissionId: entry.submissionId,
        homeworkSetId: entry.homeworkSetId,
        homeworkTitle: homeworkTitleCache.get(entry.homeworkSetId) ?? null,
        questionId: entry.questionId,
        questionPrompt: question?.prompt ?? null,
        studentAnswerSql: answer?.sql ?? null,
        attempts: entry.metrics.attempts || answer?.executionCount || 0,
        lastOutcome: resolveOutcome(
          answer?.feedback?.score ?? null,
          question?.points,
          failureTags
        ),
        lastScore: answer?.feedback?.score ?? null,
        lastTriedAt: normalizeDate(entry.updatedAt || entry.metrics.lastActivityAt),
        failureTags,
        misconceptions,
        supportSignals: {
          showAnswerClicks: entry.metrics.showAnswerClicks ?? 0,
          timeSpentMs:
            typeof entry.metrics.timeSpent === "number" ? entry.metrics.timeSpent : null,
          timeToFirstShowAnswerMs:
            typeof entry.metrics.timeToFirstShowAnswer === "number"
              ? entry.metrics.timeToFirstShowAnswer
              : null,
        },
      };
    })
    .filter((attempt): attempt is RecentSubmissionAttempt => Boolean(attempt))
    .sort((left, right) => {
      const leftTime = left.lastTriedAt ? new Date(left.lastTriedAt).getTime() : 0;
      const rightTime = right.lastTriedAt ? new Date(right.lastTriedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 6);

  const repeatedMistakeThemes = Array.from(
    new Set(
      attempts
        .flatMap((attempt) => attempt.failureTags)
        .filter(Boolean)
    )
  ).slice(0, 4);

  return {
    studentId: sources.studentId,
    generatedAt: new Date().toISOString(),
    attempts,
    repeatedMistakeThemes,
  };
}

function hoursUntil(dateString: string | null) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return Number.POSITIVE_INFINITY;
  return (target - Date.now()) / (1000 * 60 * 60);
}

function formatMisconceptionRationale(
  misconception: StudentMisconceptionSignal | null,
  fallback: string
) {
  if (!misconception) {
    return fallback;
  }

  return summarizeMisconceptionForStudent({
    category: misconception.category,
    label: misconception.label,
    studentLabel: misconception.studentLabel,
    studentExplanation: misconception.studentExplanation,
    confidence: misconception.confidence,
    topics: (misconception.topics
      .map((topicLabel) => inferPrimaryLearnerTopic(topicLabel))
      .filter(Boolean) as CanonicalTopic[]),
    reasons: misconception.reasons,
  }) ?? misconception.studentExplanation;
}

function estimateRecommendationEffort(params: {
  type: LearningStepRecommendation["type"];
  attempts?: number;
  highDeadlinePressure: boolean;
  pacePreference?: string | null;
}) {
  const quickPace =
    params.pacePreference?.toLowerCase()?.includes("fast") ||
    params.pacePreference?.toLowerCase()?.includes("quick");

  if (params.type === "request_hint") {
    return "2-4 minutes";
  }
  if (params.type === "retry_question") {
    return params.highDeadlinePressure || quickPace ? "8-12 minutes" : "12-18 minutes";
  }
  if (params.type === "personalized_quiz") {
    return params.highDeadlinePressure || quickPace ? "10-14 minutes" : "14-20 minutes";
  }
  if (params.type === "review_topic") {
    return "10-15 minutes";
  }
  return "5-8 minutes";
}

function estimateRecommendationPayoff(params: {
  type: LearningStepRecommendation["type"];
  highDeadlinePressure: boolean;
  misconception: StudentMisconceptionSignal | null;
  weakSkill: string | null;
}) {
  if (params.type === "request_hint") {
    return "Unblock the current question without wasting another full attempt.";
  }
  if (params.type === "retry_question") {
    return params.highDeadlinePressure
      ? "Highest short-term payoff for finishing the current homework on time."
      : "Turns the exact failed pattern into a solved example while it is still fresh.";
  }
  if (params.type === "personalized_quiz") {
    return params.misconception
      ? `Checks whether the ${params.misconception.studentLabel.toLowerCase()} mistake is actually fixed.`
      : "Builds confidence before the same mistake repeats again.";
  }
  if (params.weakSkill) {
    return `Raises accuracy in ${params.weakSkill} before the same gap spreads to new questions.`;
  }
  return "Gives the learner model one cleaner signal for the next recommendation.";
}

function getPrimaryMisconception(
  attempt: RecentSubmissionAttempt | null,
  strongestWeakness: TopicSignal | null
): StudentMisconceptionSignal | null {
  if (attempt?.misconceptions?.length) {
    return attempt.misconceptions[0];
  }

  const fallbackCategory = strongestWeakness?.strongestErrorTypes?.[0];
  const normalizedCategory =
    normalizeSqlMisconceptionCategory(fallbackCategory) ??
    (fallbackCategory
      ? inferSqlMisconceptions({ text: fallbackCategory })[0]?.category
      : null);

  if (!normalizedCategory) {
    return null;
  }

  const definition = getSqlMisconceptionDefinition(normalizedCategory);
  return {
    category: normalizedCategory,
    label: definition.label,
    studentLabel: definition.studentLabel,
    studentExplanation: definition.studentExplanation,
    confidence: strongestWeakness?.confidence ?? 0.5,
    topics: definition.topics.map((topic) => getLearnerTopicLabel(topic)),
    reasons: strongestWeakness?.reasons ?? [],
  };
}

function buildRecommendationMeta(params: {
  currentQuestionAttempt: RecentSubmissionAttempt | null;
  strongestWeakness: TopicSignal | null;
  strongestMasteryGap: StudentTopicMasteryRecord | null;
  primaryMisconception: StudentMisconceptionSignal | null;
  extraEvidence?: string[];
}) {
  const candidateDates = [
    params.currentQuestionAttempt?.lastTriedAt ?? null,
    params.strongestWeakness?.lastEvidenceAt ?? null,
    params.strongestMasteryGap?.lastEvidenceTime ?? null,
  ].filter(Boolean) as string[];
  const lastUpdatedAt = candidateDates[0] ?? null;
  const freshness = getFreshnessScore(lastUpdatedAt, {
    freshHours: 24 * 2,
    staleHours: 24 * 14,
  });
  const confidenceCandidates = [
    params.primaryMisconception?.confidence ?? null,
    params.strongestWeakness?.confidence ?? null,
    params.strongestMasteryGap?.confidence ?? null,
  ].filter((value): value is number => typeof value === "number");
  const confidence =
    confidenceCandidates.length > 0
      ? Number(
          (
            confidenceCandidates.reduce((sum, value) => sum + value, 0) /
            confidenceCandidates.length
          ).toFixed(3)
        )
      : 0.45;
  const basedOn = Array.from(
    new Set(
      [
        params.currentQuestionAttempt ? "recent_attempts" : null,
        params.currentQuestionAttempt?.supportSignals.showAnswerClicks
          ? "hint_usage"
          : null,
        params.primaryMisconception ? "misconception_detection" : null,
        params.strongestWeakness ? "topic_mastery" : null,
        params.strongestMasteryGap ? "mastery_gap" : null,
      ].filter(Boolean) as string[]
    )
  );

  return {
    confidence,
    freshness,
    freshnessLabel: getFreshnessLabel(freshness),
    lastUpdatedAt,
    basedOn,
    evidenceSummary: Array.from(
      new Set(
        [
          ...(params.primaryMisconception?.reasons ?? []),
          ...(params.strongestWeakness?.reasons ?? []),
          ...(params.strongestMasteryGap?.evidenceSummary ?? []),
          ...(params.extraEvidence ?? []),
        ].filter(Boolean)
      )
    ).slice(0, 5),
  };
}

function applyRecommendationReliabilityScore(baseScore: number, meta: RecommendationTrace) {
  const confidenceMultiplier = 0.7 + meta.confidence * 0.3;
  const freshnessMultiplier = 0.55 + meta.freshness * 0.45;
  return Math.round(baseScore * confidenceMultiplier * freshnessMultiplier);
}

export function buildDeadlineAndScheduleContextFromSources(
  sources: AggregatedStudentSources
): DeadlineAndScheduleContext {
  const currentHomework = sources.currentHomework
    ? getHomeworkAvailabilityInfo(sources.currentHomework, sources.userEmail)
    : null;

  return {
    studentId: sources.studentId,
    generatedAt: new Date().toISOString(),
    currentHomework: sources.currentHomework && currentHomework
      ? {
          homeworkSetId: sources.currentHomework.id,
          title: sources.currentHomework.title,
          availabilityState: currentHomework.availabilityState,
          availabilityMessage: currentHomework.availabilityMessage,
          dueAt: sources.currentHomework.dueAt ?? null,
          effectiveAvailableUntil: currentHomework.effectiveAvailableUntil,
        }
      : null,
    sameCourseDeadlines: sources.sameCourseHomework
      .map((homework) => {
        const availability = getHomeworkAvailabilityInfo(homework, sources.userEmail);
        return {
          homeworkSetId: homework.id,
          title: homework.title,
          availabilityState: availability.availabilityState,
          effectiveAvailableUntil: availability.effectiveAvailableUntil,
        };
      })
      .slice(0, 4),
  };
}

export function buildRecommendationFromSources(
  sources: AggregatedStudentSources
): RankedLearningStepRecommendation {
  const snapshot = buildStudentProgressSnapshotFromSources(sources);
  const recentAttempts = buildRecentSubmissionAttemptsFromSources(sources);
  const deadlines = buildDeadlineAndScheduleContextFromSources(sources);
  const relevantAttempts = sources.homeworkSetId
    ? recentAttempts.attempts.filter((attempt) => attempt.homeworkSetId === sources.homeworkSetId)
    : recentAttempts.attempts;
  const currentQuestionAttempt = sources.questionId
    ? relevantAttempts.find((attempt) => attempt.questionId === sources.questionId) ??
      recentAttempts.attempts.find((attempt) => attempt.questionId === sources.questionId) ??
      null
    : relevantAttempts[0] ?? recentAttempts.attempts[0] ?? null;
  const strongestWeakness = snapshot.weaknesses[0] ?? null;
  const strongestMasteryGap =
    snapshot.topicMastery.find(
      (record) =>
        record.status === "measured" &&
        record.confidence >= 0.25 &&
        record.estimatedMastery < 0.6
    ) ?? null;
  const currentHomeworkHours = deadlines.currentHomework
    ? hoursUntil(deadlines.currentHomework.effectiveAvailableUntil)
    : Number.POSITIVE_INFINITY;
  const highDeadlinePressure = Number.isFinite(currentHomeworkHours) && currentHomeworkHours <= 48;
  const highRisk = snapshot.riskSummary.riskLevel === "high";
  const pacePreference = snapshot.preferenceSummary.pacePreference;
  const currentGoal =
    snapshot.preferenceSummary.currentStudyGoal ||
    snapshot.preferenceSummary.learningGoal ||
    snapshot.preferenceSummary.examPrepGoals;
  const primaryMisconception = getPrimaryMisconception(
    currentQuestionAttempt,
    strongestWeakness
  );

  const candidates: LearningStepRecommendation[] = [];

  if (currentQuestionAttempt && currentQuestionAttempt.lastOutcome !== "passed") {
    const weakSkill =
      primaryMisconception?.topics[0] ??
      strongestMasteryGap?.label ??
      strongestWeakness?.label ??
      null;
    const retryMeta = buildRecommendationMeta({
      currentQuestionAttempt,
      strongestWeakness,
      strongestMasteryGap,
      primaryMisconception,
      extraEvidence: currentQuestionAttempt.failureTags,
    });
    candidates.push({
      id: `retry:${currentQuestionAttempt.questionId}:${sources.homeworkSetId ?? "global"}`,
      type: "retry_question",
      title: primaryMisconception
        ? `Fix the exact mistake in question ${currentQuestionAttempt.questionId}`
        : "Retry the most recent weak question",
      rationale: primaryMisconception
        ? `${formatMisconceptionRationale(
            primaryMisconception,
            ""
          )} This came from your latest attempt on this homework question.`
        : currentQuestionAttempt.failureTags.length
          ? `Recent attempt signals repeat issues around ${currentQuestionAttempt.failureTags.join(", ")}. ${strongestMasteryGap ? `The learner model also marks ${strongestMasteryGap.label} as low mastery (${Math.round(strongestMasteryGap.estimatedMastery * 100)}%) with ${Math.round(strongestMasteryGap.confidence * 100)}% confidence.` : ""}`
          : "The latest question attempt still needs work and is the fastest way to improve before moving on.",
      weakSkill,
      misconception: primaryMisconception,
      estimatedEffort: estimateRecommendationEffort({
        type: "retry_question",
        attempts: currentQuestionAttempt.attempts,
        highDeadlinePressure,
        pacePreference,
      }),
      expectedPayoff: estimateRecommendationPayoff({
        type: "retry_question",
        highDeadlinePressure,
        misconception: primaryMisconception,
        weakSkill,
      }),
      urgency: highDeadlinePressure ? "high" : "medium",
      score: applyRecommendationReliabilityScore(
        60 +
          Math.min(currentQuestionAttempt.attempts, 5) * 4 +
          (highDeadlinePressure ? 20 : 0),
        retryMeta
      ),
      confidence: retryMeta.confidence,
      freshness: retryMeta.freshness,
      freshnessLabel: retryMeta.freshnessLabel,
      lastUpdatedAt: retryMeta.lastUpdatedAt,
      basedOn: retryMeta.basedOn,
      evidenceSummary: retryMeta.evidenceSummary,
      action: {
        type: "focus_question",
        label: "Jump to the question",
        homeworkSetId: currentQuestionAttempt.homeworkSetId,
        questionId: currentQuestionAttempt.questionId,
      },
    });
  }

  if (snapshot.weaknesses.length > 0) {
    const themes = snapshot.weaknesses.slice(0, 3).map(formatWeaknessTheme);
    const quizMeta = buildRecommendationMeta({
      currentQuestionAttempt,
      strongestWeakness,
      strongestMasteryGap,
      primaryMisconception,
      extraEvidence: themes,
    });
    candidates.push({
      id: `quiz:${themes.join("|")}:${sources.homeworkSetId ?? "global"}`,
      type: "personalized_quiz",
      title: "Take a short personalized review quiz",
      rationale: primaryMisconception
        ? `The quiz will target the exact pattern "${primaryMisconception.studentLabel.toLowerCase()}" before it shows up again in a new question.`
        : `The strongest measured weak areas are ${themes.join(", ")}. ${strongestMasteryGap?.evidenceSummary[0] ?? "The learner model has enough evidence to justify a focused check."}`,
      weakSkill: strongestMasteryGap?.label ?? strongestWeakness?.label ?? null,
      misconception: primaryMisconception,
      estimatedEffort: estimateRecommendationEffort({
        type: "personalized_quiz",
        highDeadlinePressure,
        pacePreference,
      }),
      expectedPayoff: estimateRecommendationPayoff({
        type: "personalized_quiz",
        highDeadlinePressure,
        misconception: primaryMisconception,
        weakSkill: strongestMasteryGap?.label ?? strongestWeakness?.label ?? null,
      }),
      urgency: highRisk ? "high" : "medium",
      score: applyRecommendationReliabilityScore(
        55 + snapshot.weaknesses.length * 5 + (highRisk ? 10 : 0),
        quizMeta
      ),
      confidence: quizMeta.confidence,
      freshness: quizMeta.freshness,
      freshnessLabel: quizMeta.freshnessLabel,
      lastUpdatedAt: quizMeta.lastUpdatedAt,
      basedOn: quizMeta.basedOn,
      evidenceSummary: quizMeta.evidenceSummary,
      action: {
        type: "open_personalized_quiz",
        label: "Open personalized quiz",
        homeworkSetId: sources.homeworkSetId,
        themes,
      },
    });
  }

  if (strongestWeakness) {
    const reviewMeta = buildRecommendationMeta({
      currentQuestionAttempt,
      strongestWeakness,
      strongestMasteryGap,
      primaryMisconception,
      extraEvidence: [strongestWeakness.label],
    });
    candidates.push({
      id: `review:${strongestWeakness.topic}:${sources.homeworkSetId ?? "global"}`,
      type: "review_topic",
      title: `Review ${strongestWeakness.label}`,
      rationale: primaryMisconception
        ? `${formatMisconceptionRationale(
            primaryMisconception,
            ""
          )} Review the core ${strongestWeakness.label} idea once before trying the question again.`
        : strongestWeakness.reasons[0]
          ? `${strongestWeakness.reasons[0]} Confidence ${Math.round(strongestWeakness.confidence * 100)}%.`
          : "This topic still appears weaker than the rest.",
      weakSkill: strongestWeakness.label,
      misconception: primaryMisconception,
      estimatedEffort: estimateRecommendationEffort({
        type: "review_topic",
        highDeadlinePressure,
        pacePreference,
      }),
      expectedPayoff: estimateRecommendationPayoff({
        type: "review_topic",
        highDeadlinePressure,
        misconception: primaryMisconception,
        weakSkill: strongestWeakness.label,
      }),
      urgency: highRisk ? "medium" : "low",
      score: applyRecommendationReliabilityScore(40 + strongestWeakness.score, reviewMeta),
      confidence: reviewMeta.confidence,
      freshness: reviewMeta.freshness,
      freshnessLabel: reviewMeta.freshnessLabel,
      lastUpdatedAt: reviewMeta.lastUpdatedAt,
      basedOn: reviewMeta.basedOn,
      evidenceSummary: reviewMeta.evidenceSummary,
      action: {
        type: "review_topic",
        label: "Review the topic",
        topic: strongestWeakness.label,
      },
    });
  }

  if (currentQuestionAttempt && currentQuestionAttempt.attempts >= 3) {
    const hintMeta = buildRecommendationMeta({
      currentQuestionAttempt,
      strongestWeakness,
      strongestMasteryGap,
      primaryMisconception,
      extraEvidence: ["Repeated retries without a passing result."],
    });
    candidates.push({
      id: `hint:${currentQuestionAttempt.questionId}:${sources.homeworkSetId ?? "global"}`,
      type: "request_hint",
      title: "Open one hint before trying again",
      rationale: primaryMisconception
        ? `A short hint can unblock the "${primaryMisconception.studentLabel.toLowerCase()}" mistake faster than another blind retry.`
        : "Multiple executions without a passing result usually mean a small hint will unblock the next attempt faster than guessing.",
      weakSkill:
        primaryMisconception?.topics[0] ??
        strongestWeakness?.label ??
        strongestMasteryGap?.label ??
        null,
      misconception: primaryMisconception,
      estimatedEffort: estimateRecommendationEffort({
        type: "request_hint",
        highDeadlinePressure,
        pacePreference,
      }),
      expectedPayoff: estimateRecommendationPayoff({
        type: "request_hint",
        highDeadlinePressure,
        misconception: primaryMisconception,
        weakSkill:
          primaryMisconception?.topics[0] ??
          strongestWeakness?.label ??
          strongestMasteryGap?.label ??
          null,
      }),
      urgency: highDeadlinePressure ? "high" : "low",
      score: applyRecommendationReliabilityScore(
        35 + currentQuestionAttempt.attempts * 3 + (highDeadlinePressure ? 10 : 0),
        hintMeta
      ),
      confidence: hintMeta.confidence,
      freshness: hintMeta.freshness,
      freshnessLabel: hintMeta.freshnessLabel,
      lastUpdatedAt: hintMeta.lastUpdatedAt,
      basedOn: hintMeta.basedOn,
      evidenceSummary: hintMeta.evidenceSummary,
      action: {
        type: "request_hint",
        label: "Open a hint",
        homeworkSetId: currentQuestionAttempt.homeworkSetId,
        questionId: currentQuestionAttempt.questionId,
      },
    });
  }

  if (candidates.length === 0) {
    const calibrationMeta = buildRecommendationMeta({
      currentQuestionAttempt: null,
      strongestWeakness,
      strongestMasteryGap,
      primaryMisconception: null,
      extraEvidence: ["Insufficient recent evidence for a stronger intervention."],
    });
    candidates.push({
      id: `calibration:${sources.studentId}:${sources.homeworkSetId ?? "global"}`,
      type: "calibration",
      title: "Start with a short calibration exercise",
      rationale: "There is not enough recent evidence yet, so the best next step is one short task to establish the current level.",
      weakSkill: null,
      misconception: null,
      estimatedEffort: estimateRecommendationEffort({
        type: "calibration",
        highDeadlinePressure,
        pacePreference,
      }),
      expectedPayoff: estimateRecommendationPayoff({
        type: "calibration",
        highDeadlinePressure,
        misconception: null,
        weakSkill: null,
      }),
      urgency: "low",
      score: applyRecommendationReliabilityScore(10, calibrationMeta),
      confidence: calibrationMeta.confidence,
      freshness: calibrationMeta.freshness,
      freshnessLabel: calibrationMeta.freshnessLabel,
      lastUpdatedAt: calibrationMeta.lastUpdatedAt,
      basedOn: calibrationMeta.basedOn,
      evidenceSummary: calibrationMeta.evidenceSummary,
      action: {
        type: "review_topic",
        label: "Start with SQL basics",
        topic: "SQL basics",
      },
    });
  }

  candidates.sort((left, right) => right.score - left.score);

  return {
    studentId: sources.studentId,
    generatedAt: new Date().toISOString(),
    primary: candidates[0],
    alternatives: candidates.slice(1, 3),
    reasoningSummary: [
      highDeadlinePressure
        ? "Deadline pressure is high, so near-term progress is prioritized."
        : "No urgent deadline pressure is forcing a last-minute recommendation.",
      strongestMasteryGap
        ? `Top weak area: ${strongestMasteryGap.label} (mastery ${Math.round(strongestMasteryGap.estimatedMastery * 100)}%, confidence ${Math.round(strongestMasteryGap.confidence * 100)}%).`
        : "No measured weak topic is recorded yet.",
      recentAttempts.attempts.length > 0
        ? `Most recent tracked attempt: ${recentAttempts.attempts[0].lastOutcome}.`
        : "No recent attempts were available, so the recommendation falls back to calibration guidance.",
      currentGoal
        ? `Current student goal: ${currentGoal}.`
        : "No explicit student goal is stored yet.",
    ],
  };
}

export function buildPersonalizedQuizQuestionsFromThemes(
  themes: string[],
  context: {
    homeworkSetId?: string | null;
    questionId?: string | null;
    sourceAttempt?: RecentSubmissionAttempt | null;
    preferenceSummary?: StudentProgressSnapshot["preferenceSummary"];
    highDeadlinePressure?: boolean;
  },
  maxQuestions = 4
): LearningQuizQuestion[] {
  const canonicalThemes = themes
    .map((theme) => inferTopicFromText(theme))
    .filter((theme): theme is CanonicalTopic => Boolean(theme));
  const topics =
    canonicalThemes.length > 0
      ? canonicalThemes
      : (["selection_projection", "debugging"] as CanonicalTopic[]);
  const sourceAttempt = context.sourceAttempt ?? null;
  const sourceMisconception = sourceAttempt?.misconceptions?.[0] ?? null;
  const focusTopic = topics[0] ?? "debugging";
  const template = QUIZ_TEMPLATES[focusTopic] ?? QUIZ_TEMPLATES.debugging;
  const promptContext = sourceAttempt?.questionPrompt?.trim() || "the SQL question you just missed";
  const sourceSql = sourceAttempt?.studentAnswerSql?.trim() || "";
  const quickMode = Boolean(context.highDeadlinePressure);
  const stepByStep =
    context.preferenceSummary?.stepByStepTolerance?.toLowerCase()?.includes("high") ||
    context.preferenceSummary?.preferredCorrectionStyle?.toLowerCase()?.includes("step");
  const challengeHigh =
    context.preferenceSummary?.desiredChallengeLevel?.toLowerCase()?.includes("high") ||
    context.preferenceSummary?.currentStudyGoal?.toLowerCase()?.includes("exam");
  const templateMcq = template.mcq();
  const templateSql = template.sql(context.homeworkSetId, context.questionId);

  const diagnosePrompt = sourceMisconception
    ? `In "${promptContext}", what was the main mistake in the earlier attempt?`
    : `Which idea should be fixed first in "${promptContext}"?`;
  const diagnoseChoices = sourceMisconception
    ? [
        sourceMisconception.studentLabel,
        `The main problem was ${getLearnerTopicLabel("sorting").toLowerCase()}`,
        "The query only needed a different ORDER BY clause",
        "The attempt was already logically correct",
      ]
    : templateMcq.type === "mcq"
      ? templateMcq.choices
      : [];

  const diagnoseQuestion: LearningQuizQuestion = {
    id: randomUUID(),
    type: "mcq",
    prompt: diagnosePrompt,
    choices: diagnoseChoices,
    correctIndex: 0,
    hint: sourceMisconception
      ? sourceMisconception.studentExplanation
      : templateMcq.hint,
    explanation: sourceMisconception
      ? `The quiz starts by naming the exact misconception: ${sourceMisconception.studentLabel.toLowerCase()}.`
      : templateMcq.explanation,
  };

  const repairQuestion: LearningQuizQuestion = {
    id: randomUUID(),
    type: "sql",
    prompt: sourceMisconception
      ? `Repair the same idea from "${promptContext}". Write a smaller, correct query that fixes this exact problem: ${sourceMisconception.studentLabel.toLowerCase()}.`
      : `Repair the SQL structure from "${promptContext}" with one clean, correct query.`,
    starterSql: sourceSql || undefined,
    expectedSql: templateSql.type === "sql" ? templateSql.expectedSql : undefined,
    hint: stepByStep
      ? `Step 1: restate what the question must return. Step 2: fix only the ${sourceMisconception?.studentLabel.toLowerCase() ?? "broken SQL structure"}. Step 3: run the clean version.`
      : quickMode
        ? `Fix one thing only: ${sourceMisconception?.studentLabel.toLowerCase() ?? "the main SQL structure"}.`
        : templateSql.hint,
    explanation: sourceMisconception
      ? `This repair question keeps the same failure context but reduces the complexity so you can correct the misconception directly.`
      : templateSql.explanation,
    runnerConfig:
      context.homeworkSetId && context.questionId
        ? {
            setId: context.homeworkSetId,
            questionId: context.questionId,
          }
        : undefined,
  };

  const transferQuestion: LearningQuizQuestion = {
    id: randomUUID(),
    type: "sql",
    prompt: challengeHigh
      ? `Transfer the fix to a nearby pattern: solve a slightly different version of "${promptContext}" without repeating the same mistake.`
      : `Try one nearby version of "${promptContext}" to prove the fix transfers to a new case.`,
    expectedSql: templateSql.type === "sql" ? templateSql.expectedSql : undefined,
    hint: quickMode
      ? "Keep the same core pattern, but check the result columns before you run it."
      : `Use the same core pattern as the repair question, then adapt one piece of the output.`,
    explanation:
      "A transfer question checks whether the learner fixed the idea itself, not just memorized one answer.",
    runnerConfig:
      context.homeworkSetId && context.questionId
        ? {
            setId: context.homeworkSetId,
            questionId: context.questionId,
          }
        : undefined,
  };

  const confidenceQuestion: LearningQuizQuestion = {
    id: randomUUID(),
    type: "mcq",
    prompt: sourceMisconception
      ? `How would you check quickly that you fixed "${sourceMisconception.studentLabel.toLowerCase()}" before submitting?`
      : `What is the fastest self-check before submitting a query on this topic?`,
    choices: sourceMisconception
      ? [
          "Read the JOIN/filter/grouping logic against the question and the output columns one more time",
          "Change several clauses at once and hope the result improves",
          "Ignore the schema and focus only on capitalization",
          "Skip the result check if the query runs",
        ]
      : [
          "Compare the result columns and logic to the question one more time",
          "Assume any running query is correct",
          "Rewrite the whole answer from scratch without checking it",
          "Add ORDER BY even if the prompt never asks for it",
        ],
    correctIndex: 0,
    hint: quickMode
      ? "Choose the check that catches the same mistake fastest."
      : "A good confidence check is short and directly connected to the original failure.",
    explanation:
      "The last step is not harder SQL. It is a fast self-check that helps the learner catch the same misconception independently.",
  };

  return [diagnoseQuestion, repairQuestion, transferQuestion, confidenceQuestion].slice(
    0,
    Math.max(3, Math.min(maxQuestions, 5))
  );
}

export async function getStudentProgressSnapshot(
  options: ResolveStudentOptions
): Promise<StudentProgressSnapshot> {
  const sources = await getAggregatedStudentSources(options);
  return buildStudentProgressSnapshotFromSources(sources);
}

export async function getRecentSubmissionAttempts(
  options: ResolveStudentOptions
): Promise<RecentSubmissionAttemptSummary> {
  const sources = await getAggregatedStudentSources(options);
  return buildRecentSubmissionAttemptsFromSources(sources);
}

export async function getDeadlineAndScheduleContext(
  options: ResolveStudentOptions
): Promise<DeadlineAndScheduleContext> {
  const sources = await getAggregatedStudentSources(options);
  return buildDeadlineAndScheduleContextFromSources(sources);
}

export async function recommendNextLearningStep(
  options: ResolveStudentOptions
): Promise<RankedLearningStepRecommendation> {
  const sources = await getAggregatedStudentSources(options);
  return buildRecommendationFromSources(sources);
}

export async function getStudentPersonalizationBundle(
  options: ResolveStudentOptions
): Promise<StudentPersonalizationBundle> {
  const sources = await getAggregatedStudentSources(options);
  return {
    snapshot: buildStudentProgressSnapshotFromSources(sources),
    recentAttempts: buildRecentSubmissionAttemptsFromSources(sources),
    deadlines: buildDeadlineAndScheduleContextFromSources(sources),
    recommendation: buildRecommendationFromSources(sources),
  };
}

export async function generatePersonalizedQuizFromMistakes(
  options: ResolveStudentOptions & { maxQuestions?: number }
): Promise<LearningQuiz> {
  const sources = await getAggregatedStudentSources(options);
  const snapshot = buildStudentProgressSnapshotFromSources(sources);
  const recentAttempts = buildRecentSubmissionAttemptsFromSources(sources);
  const deadlines = buildDeadlineAndScheduleContextFromSources(sources);
  const themes = snapshot.weaknesses.length > 0
    ? snapshot.weaknesses.slice(0, 3).map(formatWeaknessTheme)
    : recentAttempts.repeatedMistakeThemes.length > 0
      ? recentAttempts.repeatedMistakeThemes
      : ["Selection and projection", "Debugging"];
  const sourceAttempt = options.questionId
    ? recentAttempts.attempts.find((attempt) => attempt.questionId === options.questionId) ??
      recentAttempts.attempts[0] ??
      null
    : recentAttempts.attempts[0] ?? null;
  const highDeadlinePressure = deadlines.currentHomework
    ? hoursUntil(deadlines.currentHomework.effectiveAvailableUntil) <= 48
    : false;
  const questions = buildPersonalizedQuizQuestionsFromThemes(
    themes,
    {
      homeworkSetId: options.homeworkSetId,
      questionId: options.questionId,
      sourceAttempt,
      preferenceSummary: snapshot.preferenceSummary,
      highDeadlinePressure,
    },
    options.maxQuestions ?? 4
  );
  const focusMisconception = sourceAttempt?.misconceptions?.[0] ?? null;

  const quiz: LearningQuiz = {
    quizId: randomUUID(),
    targetType: "personalized_review",
    targetId: options.homeworkSetId
      ? `${options.studentId}:${options.homeworkSetId}`
      : options.studentId,
    title: focusMisconception
      ? `Personalized SQL repair quiz: ${focusMisconception.studentLabel}`
      : "Personalized SQL review quiz",
    createdBy: "michael",
    questions,
    createdAt: new Date(),
    updatedAt: new Date(),
    personalization: {
      studentId: options.studentId,
      homeworkSetId: options.homeworkSetId ?? null,
      themes,
      sourceQuestionIds: recentAttempts.attempts.map((attempt) => attempt.questionId).slice(0, 4),
      sourceSubmissionIds: recentAttempts.attempts.map((attempt) => attempt.submissionId).slice(0, 4),
      misconceptions: sourceAttempt?.misconceptions?.map((item) => item.label).slice(0, 3),
      sourceQuestionPrompt: sourceAttempt?.questionPrompt ?? null,
    },
  };

  return createLearningQuiz(quiz);
}
