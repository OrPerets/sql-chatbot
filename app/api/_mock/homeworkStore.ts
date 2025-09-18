import { generateTempId } from "@/app/homework/utils/id";
import type {
  AnalyticsEvent,
  Dataset,
  HomeworkQueryParams,
  HomeworkSet,
  HomeworkSummary,
  PaginatedResponse,
  Question,
  QuestionProgress,
  FeedbackEntry,
  Submission,
  SubmissionSummary,
  SqlAnswer,
  SqlExecutionRequest,
  SqlExecutionResponse,
  PublishGradesResult,
} from "@/app/homework/types";

interface HomeworkRecord {
  set: HomeworkSet;
  questions: Question[];
}

const datasets: Dataset[] = [
  {
    id: "dataset-retail",
    name: "Retail Orders 2024",
    description: "Sample transactional dataset for SQL practice",
    connectionUri: "sandbox://datasets/retail-orders",
    previewTables: [
      { name: "orders", columns: ["order_id", "customer_id", "order_date", "total_amount"] },
      { name: "customers", columns: ["customer_id", "name", "loyalty_tier"] },
    ],
    tags: ["retail", "orders"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dataset-bikeshare",
    name: "City Bikeshare Trips",
    description: "Rideshare dataset with trips, stations, and weather joins",
    connectionUri: "sandbox://datasets/bikeshare",
    previewTables: [
      { name: "trips", columns: ["trip_id", "start_time", "duration", "start_station_id"] },
      { name: "stations", columns: ["station_id", "name", "lat", "lng"] },
    ],
    tags: ["transport", "time-series"],
    updatedAt: new Date().toISOString(),
  },
];

const homeworkRecords: HomeworkRecord[] = [
  {
    set: {
      id: "hw-set-analytics",
      title: "Analytics Fundamentals — Window Functions",
      courseId: "CS305",
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      published: false,
      datasetPolicy: "shared",
      questionOrder: ["q1", "q2", "q3"],
      visibility: "draft",
      createdBy: "instructor-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      overview:
        "Work through the analytics scenarios below. Each question allows three attempts and expects ANSI SQL compatible with our sandboxed executor.",
    },
    questions: [
      {
        id: "q1",
        prompt: "Identify top three customers by total spend",
        instructions: "Join orders and customers tables, aggregate total_amount, order desc.",
        starterSql: "SELECT c.name, SUM(o.total_amount) AS total_spend FROM orders o JOIN customers c ON o.customer_id = c.customer_id GROUP BY 1 ORDER BY 2 DESC LIMIT 3;",
        expectedResultSchema: [
          { column: "name", type: "string" },
          { column: "total_spend", type: "number" },
        ],
        gradingRubric: [
          {
            id: generateTempId("criterion"),
            label: "Correct aggregation",
            description: "SUM by customer",
            weight: 60,
            autoGraded: true,
          },
          {
            id: generateTempId("criterion"),
            label: "Ordering",
            description: "Results sorted descending",
            weight: 40,
            autoGraded: true,
          },
        ],
        datasetId: "dataset-retail",
        maxAttempts: 3,
        points: 10,
        evaluationMode: "auto",
      },
      {
        id: "q2",
        prompt: "Calculate 7-day moving average of total sales",
        instructions: "Use window functions over orders table grouped by date.",
        starterSql: "",
        expectedResultSchema: [
          { column: "order_date", type: "date" },
          { column: "moving_avg", type: "number" },
        ],
        gradingRubric: [
          {
            id: generateTempId("criterion"),
            label: "Window function",
            description: "Uses WINDOW clause",
            weight: 70,
            autoGraded: true,
          },
          {
            id: generateTempId("criterion"),
            label: "Date coverage",
            description: "All dates included",
            weight: 30,
            autoGraded: false,
          },
        ],
        datasetId: "dataset-retail",
        maxAttempts: 3,
        points: 10,
        evaluationMode: "auto",
      },
      {
        id: "q3",
        prompt: "Flag customers with month-over-month growth over 20%",
        instructions: "Combine aggregation with window lag comparison.",
        starterSql: "",
        expectedResultSchema: [
          { column: "customer_id", type: "string" },
          { column: "growth_rate", type: "number" },
        ],
        gradingRubric: [
          {
            id: generateTempId("criterion"),
            label: "Growth calculation",
            description: "Correctly compares current and previous month",
            weight: 60,
            autoGraded: true,
          },
          {
            id: generateTempId("criterion"),
            label: "Threshold filter",
            description: "Applies >20% threshold",
            weight: 40,
            autoGraded: true,
          },
        ],
        datasetId: "dataset-retail",
        maxAttempts: 3,
        points: 10,
        evaluationMode: "auto",
      },
    ],
  },
];

const submissionRecords: Submission[] = [
  {
    id: "submission-rose",
    homeworkSetId: "hw-set-analytics",
    studentId: "student-rose",
    attemptNumber: 1,
    answers: {
      q1: {
        sql: "SELECT c.name, SUM(o.total_amount) AS total_spend FROM orders o JOIN customers c ON o.customer_id = c.customer_id GROUP BY 1 ORDER BY 2 DESC LIMIT 3;",
        resultPreview: {
          columns: ["name", "total_spend"],
          rows: [
            { name: "Avery Patel", total_spend: 18200.54 },
            { name: "Noam Chen", total_spend: 17650.2 },
            { name: "Lina Wu", total_spend: 16990.91 },
          ],
          executionMs: 118,
          truncated: false,
        },
        feedback: {
          questionId: "q1",
          score: 10,
          autoNotes: "Top spenders match expected result set.",
          rubricBreakdown: [],
        },
        lastExecutedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        executionCount: 2,
      },
      q2: {
        sql: "SELECT order_date, AVG(total_amount) OVER (ORDER BY order_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg FROM orders;",
        resultPreview: {
          columns: ["order_date", "moving_avg"],
          rows: [
            { order_date: "2024-01-05", moving_avg: 1250.12 },
            { order_date: "2024-01-06", moving_avg: 1297.44 },
            { order_date: "2024-01-07", moving_avg: 1302.67 },
          ],
          executionMs: 162,
          truncated: false,
        },
        feedback: {
          questionId: "q2",
          score: 9,
          autoNotes: "Window frame correct; check rounding for final submission.",
          rubricBreakdown: [],
        },
        lastExecutedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
        executionCount: 3,
      },
      q3: {
        sql: "SELECT customer_id, growth_rate FROM customer_growth WHERE growth_rate > 0.2 ORDER BY growth_rate DESC;",
        resultPreview: {
          columns: ["customer_id", "growth_rate"],
          rows: [
            { customer_id: "C-204", growth_rate: 0.28 },
            { customer_id: "C-058", growth_rate: 0.24 },
          ],
          executionMs: 143,
          truncated: false,
        },
        feedback: {
          questionId: "q3",
          score: 8,
          autoNotes: "Consider adding previous month totals to support audit.",
          rubricBreakdown: [],
        },
        lastExecutedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 22 * 60 * 1000).toISOString(),
        executionCount: 2,
      },
    },
    overallScore: 27,
    status: "graded",
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    gradedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 32 * 60 * 1000).toISOString(),
  },
  {
    id: "submission-demo-student",
    homeworkSetId: "hw-set-analytics",
    studentId: "student-demo",
    attemptNumber: 1,
    answers: {
      q1: { sql: "", executionCount: 0 },
      q2: { sql: "", executionCount: 0 },
      q3: { sql: "", executionCount: 0 },
    },
    overallScore: 0,
    status: "in_progress",
    submittedAt: undefined,
    gradedAt: undefined,
  },
];

const analyticsEvents: AnalyticsEvent[] = [];

const executionCatalog: Record<string, SqlExecutionResponse> = {
  q1: {
    columns: ["name", "total_spend"],
    rows: [
      { name: "Avery Patel", total_spend: 18200.54 },
      { name: "Noam Chen", total_spend: 17650.2 },
      { name: "Lina Wu", total_spend: 16990.91 },
    ],
    executionMs: 110,
    truncated: false,
  },
  q2: {
    columns: ["order_date", "moving_avg"],
    rows: [
      { order_date: "2024-01-05", moving_avg: 1250.12 },
      { order_date: "2024-01-06", moving_avg: 1297.44 },
      { order_date: "2024-01-07", moving_avg: 1302.67 },
    ],
    executionMs: 135,
    truncated: false,
  },
  q3: {
    columns: ["customer_id", "growth_rate"],
    rows: [
      { customer_id: "C-204", growth_rate: 0.28 },
      { customer_id: "C-058", growth_rate: 0.24 },
      { customer_id: "C-311", growth_rate: 0.22 },
    ],
    executionMs: 142,
    truncated: false,
  },
};

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function computeSubmissionStats(setId: string) {
  const related = submissionRecords.filter((submission) => submission.homeworkSetId === setId);
  const graded = related.filter((submission) => submission.status === "graded");
  const averageScore = graded.length
    ? Math.round((graded.reduce((sum, submission) => sum + submission.overallScore, 0) / graded.length) * 10) /
      10
    : undefined;
  return {
    total: related.length,
    averageScore,
  };
}

export function listDatasets() {
  return datasets;
}

export function addDataset(dataset: Dataset) {
  datasets.push(dataset);
  return dataset;
}

export function getDatasetById(id: string) {
  return datasets.find((dataset) => dataset.id === id);
}

export function listHomeworkSets(params?: HomeworkQueryParams & { page?: number; pageSize?: number }): PaginatedResponse<HomeworkSummary> {
  const pageSize = params?.pageSize ?? 25;
  const page = params?.page ?? 1;
  const filtered = homeworkRecords
    .filter((record) => {
      if (!params?.status) return true;
      const status = record.set.visibility === "draft" && record.set.published ? "scheduled" : record.set.visibility;
      return params.status.includes(status as HomeworkQueryParams["status"] extends Array<infer T> ? T : never);
    })
    .map((record) => ({
      ...record.set,
      draftQuestionCount: record.questions.length,
      ...(() => {
        const stats = computeSubmissionStats(record.set.id);
        return {
          submissionCount: stats.total,
          averageScore: stats.averageScore,
        };
      })(),
    }));

  const items = filtered.slice((page - 1) * pageSize, page * pageSize);
  return {
    items,
    page,
    totalPages: Math.ceil(filtered.length / pageSize) || 1,
    totalItems: filtered.length,
  };
}

export function getHomework(setId: string) {
  const record = homeworkRecords.find((entry) => entry.set.id === setId);
  if (!record) return undefined;
  return record.set;
}

export function getHomeworkQuestions(setId: string) {
  return homeworkRecords.find((entry) => entry.set.id === setId)?.questions ?? [];
}

export function createHomework(payload: Partial<HomeworkSet> & { questions?: Question[] }) {
  const now = new Date().toISOString();
  const id = payload.id ?? generateTempId("hw");
  const record: HomeworkRecord = {
    set: {
      id,
      title: payload.title ?? "Untitled Homework",
      courseId: payload.courseId ?? "",
      dueAt: payload.dueAt ?? now,
      published: payload.published ?? false,
      datasetPolicy: payload.datasetPolicy ?? "shared",
      questionOrder: payload.questionOrder ?? payload.questions?.map((question) => question.id) ?? [],
      visibility: payload.visibility ?? "draft",
      createdBy: "instructor-1",
      createdAt: now,
      updatedAt: now,
      overview: payload.overview,
    },
    questions: payload.questions ?? [],
  };
  homeworkRecords.push(record);
  return record.set;
}

export function updateHomework(setId: string, payload: Partial<HomeworkSet>) {
  const record = homeworkRecords.find((entry) => entry.set.id === setId);
  if (!record) return undefined;
  record.set = { ...record.set, ...payload, updatedAt: new Date().toISOString() };
  return record.set;
}

export function saveDraft(setId: string, payload: SaveHomeworkDraftPayload) {
  const record = homeworkRecords.find((entry) => entry.set.id === setId);
  if (!record) return undefined;
  record.set = {
    ...record.set,
    title: payload.title ?? record.set.title,
    courseId: payload.courseId ?? record.set.courseId,
    dueAt: payload.dueAt ?? record.set.dueAt,
    datasetPolicy: payload.datasetPolicy ?? record.set.datasetPolicy,
    questionOrder: payload.questionOrder ?? record.set.questionOrder,
    visibility: payload.visibility ?? record.set.visibility,
    overview: payload.overview ?? record.set.overview,
    updatedAt: new Date().toISOString(),
  };
  if (payload.questions) {
    record.questions = payload.questions.map((question) => ({
      ...question,
      id: question.id ?? generateTempId("question"),
    }));
  }
  return record.set;
}

export function upsertQuestion(setId: string, question: Partial<Question>) {
  const record = homeworkRecords.find((entry) => entry.set.id === setId);
  if (!record) return undefined;
  const existingIndex = question.id ? record.questions.findIndex((item) => item.id === question.id) : -1;
  const normalized: Question = {
    id: question.id ?? generateTempId("question"),
    prompt: question.prompt ?? "",
    instructions: question.instructions ?? "",
    starterSql: question.starterSql ?? "",
    expectedResultSchema: question.expectedResultSchema ?? [],
    gradingRubric: question.gradingRubric ?? [],
    datasetId: question.datasetId,
    maxAttempts: question.maxAttempts ?? 3,
    points: question.points ?? 10,
    evaluationMode: question.evaluationMode,
  };
  if (existingIndex >= 0) {
    record.questions[existingIndex] = normalized;
  } else {
    record.questions.push(normalized);
    record.set.questionOrder.push(normalized.id);
  }
  record.set.updatedAt = new Date().toISOString();
  return normalized;
}

export function deleteQuestion(setId: string, questionId: string) {
  const record = homeworkRecords.find((entry) => entry.set.id === setId);
  if (!record) return false;
  record.questions = record.questions.filter((question) => question.id !== questionId);
  record.set.questionOrder = record.set.questionOrder.filter((id) => id !== questionId);
  record.set.updatedAt = new Date().toISOString();
  return true;
}

export function publishHomeworkSet(setId: string, published: boolean) {
  const record = homeworkRecords.find((entry) => entry.set.id === setId);
  if (!record) return undefined;
  record.set = { ...record.set, published, visibility: published ? "published" : record.set.visibility };
  return record.set;
}

export type SaveHomeworkDraftPayload = Partial<HomeworkSet> & { questions?: Question[] };

export type SaveSubmissionDraftPayload = Partial<Submission> & { studentId: string };

function findHomeworkRecord(setId: string) {
  return homeworkRecords.find((record) => record.set.id === setId);
}

function syncSubmissionWithQuestions(submission: Submission, record: HomeworkRecord) {
  record.set.questionOrder.forEach((questionId) => {
    if (!submission.answers[questionId]) {
      submission.answers[questionId] = { sql: "", executionCount: 0 } satisfies SqlAnswer;
    }
  });

  Object.keys(submission.answers).forEach((questionId) => {
    if (!record.set.questionOrder.includes(questionId)) {
      delete submission.answers[questionId];
    }
  });
}

function ensureSubmission(setId: string, studentId: string) {
  const record = findHomeworkRecord(setId);
  if (!record) return undefined;
  let submission = submissionRecords.find(
    (entry) => entry.homeworkSetId === setId && entry.studentId === studentId,
  );
  if (!submission) {
    submission = {
      id: generateTempId("submission"),
      homeworkSetId: setId,
      studentId,
      attemptNumber: 1,
      answers: {},
      overallScore: 0,
      status: "in_progress",
    } satisfies Submission;
    submissionRecords.push(submission);
  }
  syncSubmissionWithQuestions(submission, record);
  return submission;
}

function rebuildRubricBreakdown(question: Question | undefined, score: number): FeedbackEntry[] {
  if (!question || !question.gradingRubric?.length) return [];
  const safePoints = question.points || 1;
  return question.gradingRubric.map((criterion) => ({
    criterionId: criterion.id,
    earned: Math.round((score * criterion.weight) / safePoints),
  }));
}

function recalcOverallScore(submission: Submission, record: HomeworkRecord) {
  const total = record.set.questionOrder.reduce((sum, questionId) => {
    const question = record.questions.find((item) => item.id === questionId);
    const answer = submission.answers[questionId];
    const maxPoints = question?.points ?? 0;
    const score = Math.min(maxPoints, Math.max(0, answer?.feedback?.score ?? 0));
    return sum + score;
  }, 0);
  submission.overallScore = total;
}

function evaluateSql(question: Question | undefined, sql: string) {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { scoreRatio: 0, note: "Enter SQL before executing." } as const;
  }

  const normalized = trimmed.toLowerCase();
  if (!normalized.startsWith("select")) {
    return { scoreRatio: 0, note: "Only SELECT statements are allowed in the sandbox." } as const;
  }

  const heuristics: Record<string, (expression: string) => { scoreRatio: number; note: string }> = {
    q1: (text) => ({
      scoreRatio: text.includes("sum") && text.includes("join") ? 1 : 0.5,
      note: text.includes("sum") && text.includes("join")
        ? "Great! Aggregation and join detected."
        : "Consider joining customers and orders tables with SUM aggregation.",
    }),
    q2: (text) => ({
      scoreRatio: text.includes("over") ? 1 : 0.4,
      note: text.includes("over")
        ? "Window frame detected. Verify frame boundaries before submitting."
        : "Use a window function with OVER (...) to compute moving average.",
    }),
    q3: (text) => ({
      scoreRatio: text.includes("lag") || text.includes("growth") ? 0.8 : 0.3,
      note: text.includes("lag") || text.includes("growth")
        ? "Solid progress—growth comparison logic found."
        : "Compare current totals to prior month via LAG to compute growth.",
    }),
  };

  return heuristics[question?.id ?? ""]?.(normalized) ?? {
    scoreRatio: normalized.includes("join") ? 0.6 : 0.5,
    note: normalized.includes("join")
      ? "Joins detected. Validate aggregations and filters."
      : "Add necessary joins or filters to reach expected results.",
  };
}

function buildExecutionResponse(question: Question | undefined, questionId: string, sql: string): SqlExecutionResponse {
  const evaluation = evaluateSql(question, sql);
  const base = executionCatalog[questionId];
  const executionMs = Math.max(65, Math.round((base?.executionMs ?? 120) * (0.85 + Math.random() * 0.3)));

  const response: SqlExecutionResponse = {
    columns: evaluation.scoreRatio > 0 ? base?.columns ?? [] : [],
    rows: evaluation.scoreRatio > 0 ? base?.rows ?? [] : [],
    executionMs,
    truncated: Boolean(base?.truncated) && evaluation.scoreRatio > 0,
  };

  if (question) {
    const maxPoints = question.points ?? 10;
    const rawScore = Math.round(maxPoints * evaluation.scoreRatio);
    const score = Math.min(maxPoints, Math.max(0, rawScore));
    response.feedback = {
      questionId,
      score,
      autoNotes: evaluation.note,
      rubricBreakdown: rebuildRubricBreakdown(question, score),
    };
  }

  return response;
}

function questionProgress(submission: Submission, record: HomeworkRecord): QuestionProgress[] {
  return record.set.questionOrder.map((questionId) => {
    const answer = submission.answers[questionId];
    const question = record.questions.find((item) => item.id === questionId);
    const maxPoints = question?.points ?? 0;
    const earned = Math.min(maxPoints, Math.max(0, answer?.feedback?.score ?? 0));
    return {
      questionId,
      attempts: answer?.executionCount ?? 0,
      lastExecutedAt: answer?.lastExecutedAt,
      completed: earned > 0 || submission.status !== "in_progress",
      earnedScore: earned,
    } satisfies QuestionProgress;
  });
}

function pushAnalytics(event: Omit<AnalyticsEvent, "id" | "createdAt"> & { createdAt?: string }) {
  analyticsEvents.push({
    id: generateTempId("analytics"),
    createdAt: event.createdAt ?? new Date().toISOString(),
    ...event,
  });
}

export function getSubmissionForStudent(setId: string, studentId: string) {
  const record = findHomeworkRecord(setId);
  if (!record) return undefined;
  const submission = ensureSubmission(setId, studentId);
  if (!submission) return undefined;
  syncSubmissionWithQuestions(submission, record);
  return deepClone(submission);
}

export function getSubmissionById(submissionId: string) {
  const submission = submissionRecords.find((entry) => entry.id === submissionId);
  return submission ? deepClone(submission) : undefined;
}

export function listSubmissionSummaries(setId: string): SubmissionSummary[] {
  const record = findHomeworkRecord(setId);
  if (!record) return [];
  return submissionRecords
    .filter((entry) => entry.homeworkSetId === setId)
    .map((submission) => {
      const questions = record.set.questionOrder.length || 1;
      const answered = record.set.questionOrder.filter((questionId) => {
        const answer = submission.answers[questionId];
        return Boolean(answer?.sql?.trim()) || Boolean(answer?.feedback?.score);
      }).length;

      return {
        id: submission.id,
        studentId: submission.studentId,
        status: submission.status,
        overallScore: submission.overallScore,
        submittedAt: submission.submittedAt,
        gradedAt: submission.gradedAt,
        attemptNumber: submission.attemptNumber,
        progress: Math.min(1, Number((answered / questions).toFixed(2))),
      } satisfies SubmissionSummary;
    });
}

export function saveSubmissionDraftRecord(setId: string, payload: SaveSubmissionDraftPayload) {
  const record = findHomeworkRecord(setId);
  if (!record) return undefined;
  const submission = ensureSubmission(setId, payload.studentId);
  if (!submission) return undefined;

  if (payload.answers) {
    Object.entries(payload.answers).forEach(([questionId, incoming]) => {
      if (!record.set.questionOrder.includes(questionId)) return;
      const existing = submission.answers[questionId] ?? { sql: "", executionCount: 0 };
      submission.answers[questionId] = {
        ...existing,
        ...incoming,
        sql: incoming?.sql ?? existing.sql ?? "",
      } satisfies SqlAnswer;
    });
  }

  submission.status = "in_progress";
  recalcOverallScore(submission, record);

  pushAnalytics({
    type: "runner.save_draft",
    actorId: payload.studentId,
    setId,
    submissionId: submission.id,
    metadata: { answersUpdated: Object.keys(payload.answers ?? {}).length },
  });

  return deepClone(submission);
}

export function submitSubmissionRecord(setId: string, studentId: string) {
  const record = findHomeworkRecord(setId);
  if (!record) return undefined;
  const submission = ensureSubmission(setId, studentId);
  if (!submission) return undefined;

  submission.status = "submitted";
  submission.submittedAt = new Date().toISOString();
  submission.attemptNumber += 1;
  recalcOverallScore(submission, record);

  pushAnalytics({
    type: "runner.submit",
    actorId: studentId,
    setId,
    submissionId: submission.id,
    metadata: { overallScore: submission.overallScore },
  });

  return deepClone(submission);
}

export function gradeSubmissionRecord(submissionId: string, payload: Partial<Submission>) {
  const submission = submissionRecords.find((entry) => entry.id === submissionId);
  if (!submission) return undefined;
  const record = findHomeworkRecord(submission.homeworkSetId);
  if (!record) return undefined;

  if (payload.answers) {
    Object.entries(payload.answers).forEach(([questionId, incoming]) => {
      if (!record.set.questionOrder.includes(questionId)) return;
      const existing = submission.answers[questionId] ?? { sql: "", executionCount: 0 };
      submission.answers[questionId] = {
        ...existing,
        ...incoming,
        sql: incoming?.sql ?? existing.sql ?? "",
      } satisfies SqlAnswer;
    });
  }

  if (payload.status) {
    submission.status = payload.status;
  }

  if (payload.overallScore !== undefined) {
    submission.overallScore = payload.overallScore;
  } else {
    recalcOverallScore(submission, record);
  }

  submission.gradedAt = new Date().toISOString();

  pushAnalytics({
    type: "builder.grade_update",
    actorId: payload.studentId ?? "instructor-1",
    setId: submission.homeworkSetId,
    submissionId: submission.id,
    metadata: { overallScore: submission.overallScore },
  });

  return deepClone(submission);
}

export function executeSqlForSubmission(payload: SqlExecutionRequest) {
  const record = findHomeworkRecord(payload.setId);
  if (!record) return undefined;
  const submission = ensureSubmission(payload.setId, payload.studentId);
  if (!submission) return undefined;
  const question = record.questions.find((item) => item.id === payload.questionId);
  if (!question) return undefined;

  const answer = submission.answers[payload.questionId] ?? { sql: "", executionCount: 0 };
  if (question.maxAttempts && (answer.executionCount ?? 0) >= question.maxAttempts && !payload.preview) {
    const response: SqlExecutionResponse = {
      columns: answer.resultPreview?.columns ?? [],
      rows: answer.resultPreview?.rows ?? [],
      executionMs: answer.resultPreview?.executionMs ?? 0,
      truncated: answer.resultPreview?.truncated ?? false,
      feedback: answer.feedback ?? {
        questionId: payload.questionId,
        score: answer.feedback?.score ?? 0,
        autoNotes: "Attempt limit reached. Submit to request additional tries.",
        rubricBreakdown: [],
      },
    };
    return response;
  }

  const response = buildExecutionResponse(question, payload.questionId, payload.sql);

  submission.answers[payload.questionId] = {
    ...answer,
    sql: payload.sql,
    resultPreview: {
      columns: response.columns,
      rows: response.rows,
      executionMs: response.executionMs,
      truncated: response.truncated,
    },
    feedback: response.feedback,
    lastExecutedAt: new Date().toISOString(),
    executionCount: (answer.executionCount ?? 0) + 1,
  } satisfies SqlAnswer;

  recalcOverallScore(submission, record);

  pushAnalytics({
    type: payload.preview ? "builder.preview_execute" : "runner.execute_sql",
    actorId: payload.studentId,
    setId: payload.setId,
    questionId: payload.questionId,
    submissionId: submission.id,
    metadata: {
      executionMs: response.executionMs,
      score: response.feedback?.score,
      preview: payload.preview ?? false,
    },
  });

  return response;
}

export function getSubmissionProgressById(submissionId: string) {
  const submission = submissionRecords.find((entry) => entry.id === submissionId);
  if (!submission) return undefined;
  const record = findHomeworkRecord(submission.homeworkSetId);
  if (!record) return undefined;
  return questionProgress(submission, record);
}

export function getSubmissionProgressForStudent(setId: string, studentId: string) {
  const submission = submissionRecords.find(
    (entry) => entry.homeworkSetId === setId && entry.studentId === studentId,
  );
  const record = findHomeworkRecord(setId);
  if (!submission || !record) return undefined;
  return questionProgress(submission, record);
}

export function listAnalyticsForSet(setId: string) {
  return deepClone(analyticsEvents.filter((event) => event.setId === setId));
}

export function publishGradesForSet(setId: string): PublishGradesResult {
  const related = submissionRecords.filter((submission) => submission.homeworkSetId === setId);
  if (!related.length) {
    return {
      updated: 0,
      submissions: [],
      message: "No submissions available to publish.",
    } satisfies PublishGradesResult;
  }

  const now = new Date().toISOString();
  let updated = 0;
  related.forEach((submission) => {
    if (submission.status !== "graded") {
      submission.status = "graded";
      submission.gradedAt = now;
      updated += 1;
    }
  });

  pushAnalytics({
    type: "builder.publish_grades",
    actorId: "instructor-1",
    setId,
    metadata: { updated, total: related.length },
  });

  return {
    updated,
    submissions: deepClone(related),
    message: updated
      ? `Published ${updated} grade${updated === 1 ? "" : "s"}.`
      : "All grades were already published.",
  } satisfies PublishGradesResult;
}

export function listAnalytics() {
  return deepClone(analyticsEvents);
}
