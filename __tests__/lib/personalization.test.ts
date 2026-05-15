/**
 * @jest-environment node
 */

import type { AnalysisResult } from "@/lib/ai-analysis";
import type { SubmissionModel, QuestionAnalyticsModel } from "@/lib/models";
import type { StudentPreference } from "@/lib/student-preferences";
import type { StudentProfile } from "@/lib/student-profiles";
import type { HomeworkSet, Question } from "@/app/homework/types";
import {
  buildDeadlineAndScheduleContextFromSources,
  buildPersonalizedQuizQuestionsFromThemes,
  buildRecentSubmissionAttemptsFromSources,
  buildRecommendationFromSources,
  buildStudentProgressSnapshotFromSources,
} from "@/lib/personalization";
import type { LearningQuiz, LearningQuizResult } from "@/lib/learning-quizzes";

type Sources = Parameters<typeof buildStudentProgressSnapshotFromSources>[0];

function makeHomeworkSet(overrides: Partial<HomeworkSet> = {}): HomeworkSet {
  return {
    id: "hw-1",
    title: "Homework 1",
    courseId: "course-1",
    dueAt: "2026-04-02T10:00:00.000Z",
    availableFrom: "2026-03-28T10:00:00.000Z",
    availableUntil: "2026-04-02T10:00:00.000Z",
    published: true,
    datasetPolicy: "shared",
    questionOrder: ["q-1"],
    visibility: "published",
    createdBy: "instructor-1",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    homeworkSetId: "hw-1",
    prompt: "Write a JOIN query for orders and customers",
    instructions: "Use JOIN with the matching customer ID.",
    points: 10,
    maxAttempts: 5,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...overrides,
  } as Question;
}

function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  const now = new Date("2026-03-31T10:00:00.000Z");
  return {
    userId: "student-1",
    knowledgeScore: "needs_attention",
    knowledgeScoreHistory: [],
    lastActivity: now,
    totalQuestions: 12,
    correctAnswers: 6,
    homeworkSubmissions: 3,
    averageGrade: 71,
    commonChallenges: ["JOIN logic", "GROUP BY confusion"],
    learningProgress: {
      sqlBasics: 62,
      joins: 28,
      aggregations: 33,
      subqueries: 55,
      advancedQueries: 41,
    },
    engagementMetrics: {
      chatSessions: 4,
      averageSessionDuration: 9,
      helpRequests: 2,
      selfCorrections: 1,
    },
    riskFactors: {
      isAtRisk: true,
      riskLevel: "high",
      riskFactors: ["Repeated failed homework attempts"],
      lastAssessment: now,
    },
    conversationInsights: {
      totalSessions: 4,
      averageSessionDuration: 9,
      mostCommonTopics: ["JOIN"],
      learningTrend: "declining",
      commonChallenges: ["JOIN logic"],
      overallEngagement: "medium",
      lastAnalysisDate: now,
    },
    issueCount: 0,
    issueHistory: [],
    lastIssueUpdate: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSubmission(overrides: Partial<SubmissionModel> = {}): SubmissionModel {
  return {
    id: "submission-1",
    homeworkSetId: "hw-1",
    studentId: "student-1",
    attemptNumber: 1,
    answers: {
      "q-1": {
        sql: "select * from orders",
        executionCount: 4,
        feedback: {
          questionId: "q-1",
          score: 2,
          autoNotes: "JOIN logic is incorrect and the result is wrong.",
          rubricBreakdown: [],
        },
      },
    },
    overallScore: 20,
    status: "in_progress",
    createdAt: "2026-03-30T10:00:00.000Z",
    updatedAt: "2026-03-31T08:30:00.000Z",
    ...overrides,
  };
}

function makeAnalytics(overrides: Partial<QuestionAnalyticsModel> = {}): QuestionAnalyticsModel {
  return {
    submissionId: "submission-1",
    questionId: "q-1",
    studentId: "student-1",
    homeworkSetId: "hw-1",
    metrics: {
      timeSpent: 320000,
      typingSpeed: 24,
      attempts: 4,
      timeBetweenExecutions: [20000, 40000],
      queryExecutionTimes: [300, 280],
      charactersTyped: 150,
      editsCount: 7,
      copyPasteCount: 0,
      showAnswerClicks: 1,
      timeToFirstShowAnswer: 180000,
      showAnswerTimings: [180000],
      startedAt: "2026-03-31T07:30:00.000Z",
      lastActivityAt: "2026-03-31T08:30:00.000Z",
    },
    updatedAt: "2026-03-31T08:30:00.000Z",
    ...overrides,
  };
}

function makeSources(overrides: Partial<Sources> = {}): Sources {
  const currentHomework = makeHomeworkSet();
  const currentQuestion = makeQuestion();
  const questionsByHomeworkSet = new Map<string, Question[]>([["hw-1", [currentQuestion]]]);
  const questionsById = new Map<string, Question>([[currentQuestion.id, currentQuestion]]);

  return {
    studentId: "student-1",
    homeworkSetId: "hw-1",
    questionId: "q-1",
    userEmail: "student@example.com",
    profile: makeProfile(),
    preferences: [
      {
        userId: "student-1",
        key: "preferred_language",
        value: "he",
        source: "student",
        scope: "stable",
        confidence: 1,
        updatedAt: new Date("2026-03-30T10:00:00.000Z"),
        createdAt: new Date("2026-03-30T10:00:00.000Z"),
      },
      {
        userId: "student-1",
        key: "current_study_goal",
        value: "exam_practice",
        source: "student",
        scope: "session",
        confidence: 1,
        updatedAt: new Date("2026-03-31T09:30:00.000Z"),
        createdAt: new Date("2026-03-31T09:30:00.000Z"),
      },
      {
        userId: "student-1",
        key: "repeated_sql_weaknesses",
        value: "JOIN logic, GROUP BY",
        source: "assistant",
        scope: "stable",
        confidence: 0.8,
        updatedAt: new Date("2026-03-30T10:00:00.000Z"),
        createdAt: new Date("2026-03-30T10:00:00.000Z"),
      },
    ] as StudentPreference[],
    submissions: [makeSubmission()],
    questionAnalytics: [makeAnalytics()],
    quizResults: [
      {
        userId: "student-1",
        quizId: "quiz-1",
        attemptId: "attempt-1",
        startedAt: new Date("2026-03-30T09:00:00.000Z"),
        completedAt: new Date("2026-03-30T09:10:00.000Z"),
        score: 55,
        answers: [],
        feedbackByQuestion: [],
      },
    ] as LearningQuizResult[],
    quizzesById: new Map<string, LearningQuiz>([
      [
        "quiz-1",
        {
          quizId: "quiz-1",
          targetType: "personalized_review",
          targetId: "student-1:hw-1",
          title: "Personalized SQL review quiz",
          createdBy: "michael",
          questions: [],
          createdAt: new Date("2026-03-30T09:00:00.000Z"),
          updatedAt: new Date("2026-03-30T09:00:00.000Z"),
          personalization: {
            studentId: "student-1",
            homeworkSetId: "hw-1",
            themes: ["JOIN logic", "GROUP BY / HAVING"],
            sourceQuestionIds: ["q-1"],
            sourceSubmissionIds: ["submission-1"],
          },
        },
      ],
    ]),
    analyses: [
      {
        id: "analysis-1",
        submissionId: "submission-1",
        studentId: "student-1",
        homeworkSetId: "hw-1",
        analysisType: "failure_analysis",
        status: "completed",
        confidence: 0.9,
        results: {
          failedQuestions: [
            {
              questionId: "q-1",
              questionPrompt: "JOIN question",
              studentAnswer: { sql: "select * from orders" },
              failureReasons: ["JOIN mismatch"],
              confidence: 0.9,
              topicAreas: ["JOIN logic"],
            },
          ],
          errorPatterns: [],
          topicMapping: [
            {
              topic: "JOIN logic",
              questions: ["q-1"],
              successRate: 0.4,
              commonErrors: ["wrong ON clause"],
              difficulty: "intermediate",
            },
          ],
          recommendations: [],
          summary: "Student is struggling with joins.",
        },
        metadata: {
          processingTimeMs: 100,
          modelUsed: "test-model",
          promptVersion: "1.0",
          createdAt: "2026-03-30T09:00:00.000Z",
        },
      },
    ] as AnalysisResult[],
    currentHomework,
    sameCourseHomework: [
      makeHomeworkSet({
        id: "hw-2",
        title: "Homework 2",
        dueAt: "2026-04-04T10:00:00.000Z",
        availableUntil: "2026-04-04T10:00:00.000Z",
      }),
    ],
    questionsByHomeworkSet,
    questionsById,
    ...overrides,
  };
}

describe("personalization domain helpers", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-31T10:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds a sanitized progress snapshot with ranked weaknesses and preference summary", () => {
    const snapshot = buildStudentProgressSnapshotFromSources(makeSources());

    expect(snapshot.studentId).toBe("student-1");
    expect(snapshot.weaknesses[0]?.label).toBe("JOIN logic");
    expect(snapshot.topicMastery[0]?.label).toBe("JOIN logic");
    expect(snapshot.topicMastery[0]?.confidence).toBeGreaterThan(0.4);
    expect(snapshot.topicMastery[0]?.freshnessLabel).toBe("fresh");
    expect(snapshot.preferenceSummary.preferredLanguage).toBe("he");
    expect(snapshot.preferenceSummary.currentStudyGoal).toBe("exam_practice");
    expect(snapshot.quizSummary.topicsToRevisit).toContain("JOIN logic");
    expect(snapshot).not.toHaveProperty("name");
    expect(snapshot).not.toHaveProperty("email");
  });

  it("summarizes recent submission attempts from analytics and submission feedback", () => {
    const summary = buildRecentSubmissionAttemptsFromSources(makeSources());

    expect(summary.attempts).toHaveLength(1);
    expect(summary.attempts[0]).toMatchObject({
      questionId: "q-1",
      attempts: 4,
      lastOutcome: "needs_work",
    });
    expect(summary.attempts[0].failureTags).toContain("JOIN logic");
    expect(summary.repeatedMistakeThemes).toContain("JOIN logic");
  });

  it("builds deadline context for the current homework and same-course siblings", () => {
    const deadlines = buildDeadlineAndScheduleContextFromSources(makeSources());

    expect(deadlines.currentHomework).toMatchObject({
      homeworkSetId: "hw-1",
      title: "Homework 1",
    });
    expect(deadlines.sameCourseDeadlines[0]).toMatchObject({
      homeworkSetId: "hw-2",
      title: "Homework 2",
    });
  });

  it("prioritizes retrying the active homework question when deadline pressure is high", () => {
    const recommendation = buildRecommendationFromSources(makeSources());

    expect(recommendation.primary.type).toBe("retry_question");
    expect(recommendation.primary.urgency).toBe("high");
    expect(recommendation.primary.misconception?.category).toBe("wrong_join_predicate");
    expect(recommendation.primary.weakSkill).toBe("JOIN logic");
    expect(recommendation.primary.rationale).toContain("JOIN");
    expect(recommendation.primary.confidence).toBeGreaterThan(0.5);
    expect(recommendation.primary.freshnessLabel).toBe("fresh");
    expect(recommendation.primary.basedOn).toContain("recent_attempts");
    expect(recommendation.primary.action).toMatchObject({
      type: "focus_question",
      homeworkSetId: "hw-1",
      questionId: "q-1",
    });
  });

  it("marks stale evidence so recommendations are visibly lower freshness", () => {
    const staleRecommendation = buildRecommendationFromSources(
      makeSources({
        profile: makeProfile({
          lastActivity: new Date("2026-01-01T10:00:00.000Z"),
          updatedAt: new Date("2026-01-01T10:00:00.000Z"),
        }),
        submissions: [
          makeSubmission({
            createdAt: "2026-01-01T10:00:00.000Z",
            updatedAt: "2026-01-01T10:00:00.000Z",
          }),
        ],
        questionAnalytics: [
          makeAnalytics({
            updatedAt: "2026-01-01T10:00:00.000Z",
            metrics: {
              ...makeAnalytics().metrics,
              startedAt: "2026-01-01T09:00:00.000Z",
              lastActivityAt: "2026-01-01T10:00:00.000Z",
            },
          }),
        ],
      })
    );

    expect(staleRecommendation.primary.freshnessLabel).toBe("stale");
    expect(staleRecommendation.primary.freshness).toBeLessThan(0.34);
  });

  it("falls back to a calibration recommendation when there is no history", () => {
    const recommendation = buildRecommendationFromSources(
      makeSources({
        profile: null,
        preferences: [],
        submissions: [],
        questionAnalytics: [],
        quizResults: [],
        quizzesById: new Map(),
        analyses: [],
        questionId: null,
      })
    );

    expect(recommendation.primary.type).toBe("calibration");
    expect(recommendation.primary.action).toMatchObject({
      type: "review_topic",
      topic: "SQL basics",
    });
  });

  it("creates a bounded personalized quiz from the strongest themes", () => {
    const questions = buildPersonalizedQuizQuestionsFromThemes(
      ["JOIN logic", "GROUP BY / HAVING", "JOIN logic"],
      {
        homeworkSetId: "hw-1",
        questionId: "q-1",
        sourceAttempt: buildRecentSubmissionAttemptsFromSources(makeSources()).attempts[0],
        preferenceSummary: buildStudentProgressSnapshotFromSources(makeSources()).preferenceSummary,
        highDeadlinePressure: true,
      },
      4
    );

    expect(questions).toHaveLength(4);
    expect(questions[0]?.type).toBe("mcq");
    expect(questions[1]?.type).toBe("sql");
    expect(questions[2]?.type).toBe("sql");
    expect(questions[3]?.type).toBe("mcq");
    expect(questions[0]?.prompt).toContain("JOIN");
    expect(questions[1]?.prompt).toContain("Write a JOIN query");
  });
});
