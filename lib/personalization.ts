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
import { getHomeworkSetById } from "@/lib/homework";
import type { QuestionAnalyticsModel, SubmissionModel } from "@/lib/models";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import {
  getStudentProfile,
  type StudentProfile,
} from "@/lib/student-profiles";
import {
  listStudentPreferences,
  type StudentPreference,
} from "@/lib/student-preferences";
import { getUsersService } from "@/lib/users";
import type { HomeworkSet, Question } from "@/app/homework/types";

type CanonicalTopic =
  | "sql_basics"
  | "joins"
  | "filters"
  | "aggregations"
  | "subqueries"
  | "ordering"
  | "syntax"
  | "logic"
  | "performance";

type TopicSignalKind = "strength" | "weakness";

export type TopicSignal = {
  topic: CanonicalTopic;
  label: string;
  kind: TopicSignalKind;
  score: number;
  reasons: string[];
};

export type StudentProgressSnapshot = {
  studentId: string;
  generatedAt: string;
  knowledgeScore: StudentProfile["knowledgeScore"] | "unknown";
  recentTrend: StudentProfile["conversationInsights"]["learningTrend"] | "unknown";
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
  attempts: number;
  lastOutcome: "passed" | "needs_work" | "ungraded";
  lastScore: number | null;
  lastTriedAt: string | null;
  failureTags: string[];
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
  urgency: "low" | "medium" | "high";
  score: number;
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

const TOPIC_LABELS: Record<CanonicalTopic, string> = {
  sql_basics: "SQL basics",
  joins: "JOIN logic",
  filters: "WHERE filters",
  aggregations: "GROUP BY / HAVING",
  subqueries: "Subqueries",
  ordering: "ORDER BY",
  syntax: "SQL syntax",
  logic: "Query logic",
  performance: "Query performance",
};

const QUIZ_TEMPLATES: Record<CanonicalTopic, QuizTemplate> = {
  sql_basics: {
    topic: "sql_basics",
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
  filters: {
    topic: "filters",
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
  aggregations: {
    topic: "aggregations",
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
  ordering: {
    topic: "ordering",
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
  syntax: {
    topic: "syntax",
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
  logic: {
    topic: "logic",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "A query can be syntactically valid but logically wrong when it:",
      choices: [
        "Runs without errors but answers a different question than intended",
        "Contains uppercase keywords",
        "Uses SELECT",
        "Returns fewer than 100 rows",
      ],
      correctIndex: 0,
      hint: "Logic errors are about meaning, not parser rules.",
      explanation: "Logical correctness means the query matches the task, not just the SQL grammar.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns only approved enrollments from `enrollments`.",
      expectedSql: "SELECT * FROM enrollments WHERE status = 'approved'",
      hint: "Focus on the condition that matches the business rule.",
      explanation: "Logic errors often happen when the filtering condition does not match the requested business rule.",
    }),
  },
  performance: {
    topic: "performance",
    mcq: () => ({
      id: randomUUID(),
      type: "mcq",
      prompt: "Which change usually improves readability and performance review first?",
      choices: [
        "Selecting only needed columns instead of SELECT *",
        "Adding random aliases",
        "Sorting every query by all columns",
        "Duplicating WHERE conditions",
      ],
      correctIndex: 0,
      hint: "Start with simpler, narrower queries.",
      explanation: "Selecting only needed columns reduces unnecessary work and makes intent clearer.",
    }),
    sql: () => ({
      id: randomUUID(),
      type: "sql",
      prompt: "Write a query that returns only `customer_id` and `order_total` from `orders` where `order_total` is above 500.",
      expectedSql: "SELECT customer_id, order_total FROM orders WHERE order_total > 500",
      hint: "Avoid SELECT * when you only need a few columns.",
      explanation: "Performance advice starts with filtering early and projecting only the needed columns.",
    }),
  },
};

const TOPIC_KEYWORDS: Array<{ topic: CanonicalTopic; patterns: RegExp[] }> = [
  { topic: "joins", patterns: [/\bjoin\b/i, /\bon\b/i, /foreign key/i] },
  { topic: "filters", patterns: [/\bwhere\b/i, /filter/i, /condition/i] },
  { topic: "aggregations", patterns: [/\bgroup by\b/i, /\bhaving\b/i, /\bcount\b/i, /\bavg\b/i, /\bsum\b/i, /aggregate/i] },
  { topic: "subqueries", patterns: [/\bsubquery\b/i, /nested query/i, /\bselect .*select\b/i] },
  { topic: "ordering", patterns: [/\border by\b/i, /\bdesc\b/i, /\basc\b/i, /sort/i] },
  { topic: "syntax", patterns: [/syntax/i, /parse/i, /unexpected token/i] },
  { topic: "logic", patterns: [/logic/i, /incorrect/i, /wrong result/i, /business rule/i] },
  { topic: "performance", patterns: [/performance/i, /slow/i, /optimi[sz]e/i, /select \*/i] },
  { topic: "sql_basics", patterns: [/\bselect\b/i, /\bfrom\b/i, /basic/i] },
];

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

function toSignalLabel(topic: CanonicalTopic): string {
  return TOPIC_LABELS[topic];
}

function addSignal(
  store: Map<CanonicalTopic, TopicSignal>,
  topic: CanonicalTopic,
  kind: TopicSignalKind,
  score: number,
  reason: string
) {
  const existing = store.get(topic);
  if (!existing) {
    store.set(topic, {
      topic,
      label: toSignalLabel(topic),
      kind,
      score,
      reasons: [reason],
    });
    return;
  }

  existing.score += score;
  if (!existing.reasons.includes(reason)) {
    existing.reasons.push(reason);
  }
  if (kind === "weakness" && existing.kind === "strength") {
    existing.kind = "weakness";
  }
}

function inferTopicFromText(value: string | null | undefined): CanonicalTopic | null {
  if (!value) return null;

  for (const entry of TOPIC_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(value))) {
      return entry.topic;
    }
  }

  return null;
}

function extractFailureTagsFromText(text: string | null | undefined): string[] {
  if (!text) return [];

  const tags = new Set<string>();
  const topic = inferTopicFromText(text);
  if (topic) {
    tags.add(toSignalLabel(topic));
  }

  const lower = text.toLowerCase();
  if (lower.includes("syntax")) tags.add("syntax");
  if (lower.includes("join")) tags.add("join");
  if (lower.includes("where") || lower.includes("filter")) tags.add("filter");
  if (lower.includes("group") || lower.includes("having") || lower.includes("aggregate")) tags.add("aggregation");
  if (lower.includes("subquery")) tags.add("subquery");
  if (lower.includes("performance")) tags.add("performance");
  if (lower.includes("logic") || lower.includes("wrong result")) tags.add("logic");

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

async function resolveStudentEmail(studentId: string): Promise<string | null> {
  try {
    const usersService = await getUsersService();
    const user = await usersService.findUserByIdOrEmail(studentId);
    return user?.email ?? null;
  } catch {
    return null;
  }
}

async function getAggregatedStudentSources(options: ResolveStudentOptions): Promise<AggregatedStudentSources> {
  const { db } = await connectToDatabase();
  const analysisService = await getAnalysisService();
  const userEmail = await resolveStudentEmail(options.studentId);

  const [profile, preferences, analyses, quizResults, currentHomework] = await Promise.all([
    getStudentProfile(options.studentId),
    listStudentPreferences(options.studentId),
    analysisService.getAnalysisResultsForStudent(
      options.studentId,
      options.homeworkSetId ?? undefined
    ),
    getLearningQuizResultsForUser(options.studentId),
    options.homeworkSetId ? getHomeworkSetById(options.homeworkSetId) : Promise.resolve(null),
  ]);

  const quizIds = Array.from(new Set(quizResults.map((result) => result.quizId)));
  const quizzes = await getLearningQuizzesByIds(quizIds);
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.quizId, quiz]));

  const submissions = await executeWithRetry(async (database) =>
    database
      .collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS)
      .find({ studentId: options.studentId })
      .sort({ updatedAt: -1, submittedAt: -1 })
      .limit(12)
      .toArray()
  );

  const questionAnalytics = await executeWithRetry(async (database) =>
    database
      .collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS)
      .find({ studentId: options.studentId })
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
    studentId: options.studentId,
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

function buildTopicSignals(sources: AggregatedStudentSources) {
  const strengths = new Map<CanonicalTopic, TopicSignal>();
  const weaknesses = new Map<CanonicalTopic, TopicSignal>();

  const progress = sources.profile?.learningProgress;
  if (progress) {
    const entries: Array<[CanonicalTopic, number]> = [
      ["sql_basics", progress.sqlBasics],
      ["joins", progress.joins],
      ["aggregations", progress.aggregations],
      ["subqueries", progress.subqueries],
      ["performance", progress.advancedQueries],
    ];

    entries.forEach(([topic, score]) => {
      if (score >= 70) {
        addSignal(strengths, topic, "strength", 2, "Learning progress is consistently strong");
      }
      if (score > 0 && score <= 45) {
        addSignal(weaknesses, topic, "weakness", 3, "Learning progress is still low");
      }
    });
  }

  (sources.profile?.commonChallenges ?? []).forEach((challenge) => {
    const topic = inferTopicFromText(challenge) ?? "logic";
    addSignal(weaknesses, topic, "weakness", 2, `Recurring challenge: ${challenge}`);
  });

  sources.preferences.forEach((preference) => {
    if (preference.key !== "repeated_sql_weaknesses") return;

    parsePreferenceList(preference.value).forEach((item) => {
      const topic = inferTopicFromText(item) ?? "logic";
      addSignal(weaknesses, topic, "weakness", 2, `Stored preference weakness: ${item}`);
    });
  });

  sources.analyses.forEach((analysis) => {
    analysis.results?.topicMapping?.forEach((mapping) => {
      const topic = inferTopicFromText(mapping.topic);
      if (!topic) return;

      if (mapping.successRate >= 0.8) {
        addSignal(strengths, topic, "strength", 3, `AI analysis shows strong success in ${mapping.topic}`);
      } else if (mapping.successRate <= 0.6) {
        addSignal(weaknesses, topic, "weakness", 3, `AI analysis shows low success in ${mapping.topic}`);
      }
    });

    analysis.results?.failedQuestions?.forEach((failedQuestion) => {
      failedQuestion.topicAreas.forEach((area) => {
        const topic = inferTopicFromText(area);
        if (topic) {
          addSignal(weaknesses, topic, "weakness", 2, `Recent failed question involved ${area}`);
        }
      });
    });
  });

  const submissionLookup = new Map(sources.submissions.map((submission) => [submission.id, submission]));
  sources.questionAnalytics.forEach((entry) => {
    const question = sources.questionsById.get(entry.questionId);
    const submission = submissionLookup.get(entry.submissionId);
    const answer = submission?.answers?.[entry.questionId];
    const notes = [
      answer?.feedback?.autoNotes,
      answer?.feedback?.instructorNotes,
      question?.prompt,
      question?.instructions,
    ]
      .filter(Boolean)
      .join(" ");

    const topic = inferTopicFromText(notes);
    if (!topic) return;

    const outcome = resolveOutcome(answer?.feedback?.score ?? null, question?.points, extractFailureTagsFromText(notes));
    if (outcome === "passed") {
      addSignal(strengths, topic, "strength", 1, `Recent successful attempt in ${toSignalLabel(topic)}`);
    } else {
      addSignal(weaknesses, topic, "weakness", 2, `Recent struggle in ${toSignalLabel(topic)}`);
    }
  });

  return {
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

export function buildStudentProgressSnapshotFromSources(
  sources: AggregatedStudentSources
): StudentProgressSnapshot {
  const preferenceMap = new Map(sources.preferences.map((preference) => [preference.key, preference.value]));
  const signals = buildTopicSignals(sources);
  const quizSummary = buildQuizSummary(sources);

  return {
    studentId: sources.studentId,
    generatedAt: new Date().toISOString(),
    knowledgeScore: sources.profile?.knowledgeScore ?? "unknown",
    recentTrend: sources.profile?.conversationInsights?.learningTrend ?? "unknown",
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
      preferredLanguage: preferenceMap.get("preferred_language") ?? null,
      preferredExplanationDepth: preferenceMap.get("preferred_explanation_depth") ?? null,
      examPrepGoals: preferenceMap.get("exam_prep_goals") ?? null,
      repeatedWeaknesses: parsePreferenceList(preferenceMap.get("repeated_sql_weaknesses")),
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
        attempts: entry.metrics.attempts || answer?.executionCount || 0,
        lastOutcome: resolveOutcome(
          answer?.feedback?.score ?? null,
          question?.points,
          failureTags
        ),
        lastScore: answer?.feedback?.score ?? null,
        lastTriedAt: normalizeDate(entry.updatedAt || entry.metrics.lastActivityAt),
        failureTags,
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
  const currentHomeworkHours = deadlines.currentHomework
    ? hoursUntil(deadlines.currentHomework.effectiveAvailableUntil)
    : Number.POSITIVE_INFINITY;
  const highDeadlinePressure = Number.isFinite(currentHomeworkHours) && currentHomeworkHours <= 48;
  const highRisk = snapshot.riskSummary.riskLevel === "high";

  const candidates: LearningStepRecommendation[] = [];

  if (currentQuestionAttempt && currentQuestionAttempt.lastOutcome !== "passed") {
    candidates.push({
      id: `retry:${currentQuestionAttempt.questionId}:${sources.homeworkSetId ?? "global"}`,
      type: "retry_question",
      title: "Retry the most recent weak question",
      rationale: currentQuestionAttempt.failureTags.length
        ? `Recent attempt signals repeat issues around ${currentQuestionAttempt.failureTags.join(", ")}.`
        : "The latest question attempt still needs work and is the fastest way to improve before moving on.",
      urgency: highDeadlinePressure ? "high" : "medium",
      score:
        60 +
        Math.min(currentQuestionAttempt.attempts, 5) * 4 +
        (highDeadlinePressure ? 20 : 0),
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
    candidates.push({
      id: `quiz:${themes.join("|")}:${sources.homeworkSetId ?? "global"}`,
      type: "personalized_quiz",
      title: "Take a short personalized review quiz",
      rationale: `The strongest repeated weak areas are ${themes.join(", ")}. A focused quiz will confirm whether the mistakes are actually fixed.`,
      urgency: highRisk ? "high" : "medium",
      score: 55 + snapshot.weaknesses.length * 5 + (highRisk ? 10 : 0),
      action: {
        type: "open_personalized_quiz",
        label: "Open personalized quiz",
        homeworkSetId: sources.homeworkSetId,
        themes,
      },
    });
  }

  if (strongestWeakness) {
    candidates.push({
      id: `review:${strongestWeakness.topic}:${sources.homeworkSetId ?? "global"}`,
      type: "review_topic",
      title: `Review ${strongestWeakness.label}`,
      rationale: strongestWeakness.reasons[0] ?? "This topic still appears weaker than the rest.",
      urgency: highRisk ? "medium" : "low",
      score: 40 + strongestWeakness.score,
      action: {
        type: "review_topic",
        label: "Review the topic",
        topic: strongestWeakness.label,
      },
    });
  }

  if (currentQuestionAttempt && currentQuestionAttempt.attempts >= 3) {
    candidates.push({
      id: `hint:${currentQuestionAttempt.questionId}:${sources.homeworkSetId ?? "global"}`,
      type: "request_hint",
      title: "Open one hint before trying again",
      rationale: "Multiple executions without a passing result usually mean a small hint will unblock the next attempt faster than guessing.",
      urgency: highDeadlinePressure ? "high" : "low",
      score: 35 + currentQuestionAttempt.attempts * 3 + (highDeadlinePressure ? 10 : 0),
      action: {
        type: "request_hint",
        label: "Open a hint",
        homeworkSetId: currentQuestionAttempt.homeworkSetId,
        questionId: currentQuestionAttempt.questionId,
      },
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      id: `calibration:${sources.studentId}:${sources.homeworkSetId ?? "global"}`,
      type: "calibration",
      title: "Start with a short calibration exercise",
      rationale: "There is not enough recent evidence yet, so the best next step is one short task to establish the current level.",
      urgency: "low",
      score: 10,
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
      snapshot.weaknesses.length > 0
        ? `Top weak area: ${snapshot.weaknesses[0].label}.`
        : "No dominant weak topic is recorded yet.",
      recentAttempts.attempts.length > 0
        ? `Most recent tracked attempt: ${recentAttempts.attempts[0].lastOutcome}.`
        : "No recent attempts were available, so the recommendation falls back to calibration guidance.",
    ],
  };
}

export function buildPersonalizedQuizQuestionsFromThemes(
  themes: string[],
  context: { homeworkSetId?: string | null; questionId?: string | null },
  maxQuestions = 4
): LearningQuizQuestion[] {
  const canonicalThemes = themes
    .map((theme) => inferTopicFromText(theme))
    .filter((theme): theme is CanonicalTopic => Boolean(theme));
  const topics = canonicalThemes.length > 0 ? canonicalThemes : (["sql_basics", "logic"] as CanonicalTopic[]);

  const questions: LearningQuizQuestion[] = [];
  for (const topic of topics) {
    const template = QUIZ_TEMPLATES[topic];
    if (!template) continue;
    questions.push(template.mcq());
    if (questions.length < maxQuestions) {
      questions.push(template.sql(context.homeworkSetId, context.questionId));
    }
    if (questions.length >= maxQuestions) {
      break;
    }
  }

  return questions.slice(0, Math.max(3, Math.min(maxQuestions, 5)));
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
  const themes = snapshot.weaknesses.length > 0
    ? snapshot.weaknesses.slice(0, 3).map(formatWeaknessTheme)
    : recentAttempts.repeatedMistakeThemes.length > 0
      ? recentAttempts.repeatedMistakeThemes
      : ["SQL basics", "Query logic"];
  const questions = buildPersonalizedQuizQuestionsFromThemes(
    themes,
    {
      homeworkSetId: options.homeworkSetId,
      questionId: options.questionId,
    },
    options.maxQuestions ?? 4
  );

  const quiz: LearningQuiz = {
    quizId: randomUUID(),
    targetType: "personalized_review",
    targetId: options.homeworkSetId
      ? `${options.studentId}:${options.homeworkSetId}`
      : options.studentId,
    title: "Personalized SQL review quiz",
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
    },
  };

  return createLearningQuiz(quiz);
}
