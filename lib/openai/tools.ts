import { demoDatabase } from "@/app/visualizer/mock-schema";
import type { SqlResultRow } from "@/app/homework/types";
import { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } from "@/lib/content";
import { getHomeworkSetById } from "@/lib/homework";
import { ToolCallRequest } from "@/lib/openai/contracts";
import { getPracticeTables } from "@/lib/practice";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import {
  SQL_CURRICULUM_MAP,
  getAllowedConceptsForWeek,
  getForbiddenConceptsForWeek,
} from "@/lib/sql-curriculum";
import { getStudentProfile } from "@/lib/student-profiles";
import {
  StudentPreferenceKey,
  listStudentPreferences,
  upsertStudentPreference,
} from "@/lib/student-preferences";

type JsonSchema = Record<string, unknown>;

export type FunctionToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
  strict?: boolean;
};

export type CodeInterpreterToolDefinition = {
  type: "code_interpreter";
  container?: { type: "auto" };
};

export type MichaelToolDefinition =
  | FunctionToolDefinition
  | CodeInterpreterToolDefinition;

export type ToolLifecycle = "production" | "experimental" | "disabled";
export type MichaelToolContext = "main_chat" | "homework_runner" | "admin" | "voice";

export type ToolCatalogEntry = {
  schema: MichaelToolDefinition;
  lifecycle: ToolLifecycle;
  enabledContexts: MichaelToolContext[];
  statusNote?: string;
};

export type ToolExecutionContext = {
  toolContext?: MichaelToolContext;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  chatId?: string;
  homeworkSetId?: string;
  questionId?: string;
  studentId?: string;
};

type ToolExecutionResult = unknown;
type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

const getCourseWeekContextTool: FunctionToolDefinition = {
  type: "function",
  name: "get_course_week_context",
  description:
    "Return the active SQL course week context, plus allowed and forbidden SQL concepts.",
  parameters: {
    type: "object",
    description:
      "Optional week override for instructor or debugging use. When omitted, resolves by the active academic week.",
    properties: {
      week: { type: "number" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const executeSqlQueryTool: FunctionToolDefinition = {
  type: "function",
  name: "execute_sql_query",
  description:
    "Execute a student-safe read-only SQL query in the tutoring sandbox. Use for examples, practice schemas, and homework only when scoped context is available.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      database: { type: "string", enum: ["practice", "examples", "homework"] },
      practice_id: { type: "string" },
      homework_set_id: { type: "string" },
      student_id: { type: "string" },
      question_id: { type: "string" },
      row_limit: { type: "number" },
      timeout_ms: { type: "number" },
      explain_plan: { type: "boolean" },
      educational_context: { type: "string" },
    },
    required: ["query", "database"],
    additionalProperties: false,
  },
  strict: true,
};

const validateSqlAnswerTool: FunctionToolDefinition = {
  type: "function",
  name: "validate_sql_answer",
  description:
    "Validate a student's SQL against expected constraints before explaining the answer.",
  parameters: {
    type: "object",
    properties: {
      student_query: { type: "string" },
      reference_query: { type: "string" },
      required_tables: { type: "array", items: { type: "string" } },
      required_keywords: { type: "array", items: { type: "string" } },
      forbidden_keywords: { type: "array", items: { type: "string" } },
      expected_columns: { type: "array", items: { type: "string" } },
      allowed_concepts: { type: "array", items: { type: "string" } },
      forbidden_concepts: { type: "array", items: { type: "string" } },
    },
    required: ["student_query"],
    additionalProperties: false,
  },
  strict: true,
};

const compareSqlQueriesTool: FunctionToolDefinition = {
  type: "function",
  name: "compare_sql_queries",
  description:
    "Compare two SQL queries and explain correctness, readability, and efficiency differences in tutoring language.",
  parameters: {
    type: "object",
    properties: {
      student_query: { type: "string" },
      reference_query: { type: "string" },
      goal: { type: "string" },
      focus: {
        type: "string",
        enum: ["correctness", "readability", "efficiency", "all"],
      },
    },
    required: ["student_query", "reference_query"],
    additionalProperties: false,
  },
  strict: true,
};

const getHomeworkContextTool: FunctionToolDefinition = {
  type: "function",
  name: "get_homework_context",
  description:
    "Return homework-specific schema, questions, due dates, allowed concepts, and rubric hints for tutoring.",
  parameters: {
    type: "object",
    properties: {
      homework_set_id: { type: "string" },
      question_id: { type: "string" },
      include_questions: { type: "boolean" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const getStudentLearningProfileTool: FunctionToolDefinition = {
  type: "function",
  name: "get_student_learning_profile",
  description:
    "Return a student's learning profile and tutoring preferences so Michael can adapt explanation depth and difficulty.",
  parameters: {
    type: "object",
    properties: {
      student_id: { type: "string" },
      include_preferences: { type: "boolean" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const rememberStudentPreferenceTool: FunctionToolDefinition = {
  type: "function",
  name: "remember_student_preference",
  description:
    "Save a stable tutoring preference such as preferred language, explanation depth, repeated SQL weakness, or exam-prep goal.",
  parameters: {
    type: "object",
    properties: {
      preference_key: {
        type: "string",
        enum: [
          "preferred_language",
          "preferred_explanation_depth",
          "repeated_sql_weaknesses",
          "exam_prep_goals",
        ],
      },
      value: { type: "string" },
      notes: { type: "string" },
      student_id: { type: "string" },
    },
    required: ["preference_key", "value"],
    additionalProperties: false,
  },
  strict: true,
};

const generateNextPracticeStepTool: FunctionToolDefinition = {
  type: "function",
  name: "generate_next_practice_step",
  description:
    "Turn the student's current mistake or question into the next recommended practice step.",
  parameters: {
    type: "object",
    properties: {
      topic: { type: "string" },
      mistake_summary: { type: "string" },
      current_level: {
        type: "string",
        enum: ["beginner", "intermediate", "advanced"],
      },
      target_language: { type: "string", enum: ["he", "en"] },
    },
    additionalProperties: false,
  },
  strict: true,
};

const getDatabaseSchemaTool: FunctionToolDefinition = {
  type: "function",
  name: "get_database_schema",
  description:
    "Return schema metadata for approved educational SQL database contexts, including practice tables and curated example schemas.",
  parameters: {
    type: "object",
    properties: {
      database: { type: "string", enum: ["practice", "examples", "homework"] },
      practice_id: { type: "string" },
      homework_set_id: { type: "string" },
      table_pattern: { type: "string" },
      include_relationships: { type: "boolean" },
    },
    required: ["database"],
    additionalProperties: false,
  },
  strict: true,
};

const analyzeQueryPerformanceTool: FunctionToolDefinition = {
  type: "function",
  name: "analyze_query_performance",
  description:
    "Analyze a SQL query and return educational optimization hints. Best used for examples and conceptual feedback, not production query plans.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      database_context: { type: "object" },
      learning_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const renderSqlVisualizationTool: FunctionToolDefinition = {
  type: "function",
  name: "render_sql_visualization",
  description:
    "Return structured table, join, filter, and result-preview data for rendering SQL visualizations in the UI.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      result_preview: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const listInstructorMcpCapabilitiesTool: FunctionToolDefinition = {
  type: "function",
  name: "list_instructor_mcp_capabilities",
  description:
    "List candidate remote MCP integrations Michael can use for instructor workflows such as Drive, Sheets, and Notion.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  strict: true,
};

const codeInterpreterTool: CodeInterpreterToolDefinition = {
  type: "code_interpreter",
  container: { type: "auto" },
};

const TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    schema: getCourseWeekContextTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin", "voice"],
  },
  {
    schema: getDatabaseSchemaTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    statusNote:
      "Uses real practice metadata and homework-set metadata when a homework context is available.",
  },
  {
    schema: executeSqlQueryTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    statusNote:
      "Student-safe sandbox only. Read-only queries, scoped schemas, row limits, and friendly tutoring errors are enforced.",
  },
  {
    schema: validateSqlAnswerTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: compareSqlQueriesTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: getHomeworkContextTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: getStudentLearningProfileTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: rememberStudentPreferenceTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: generateNextPracticeStepTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: analyzeQueryPerformanceTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: renderSqlVisualizationTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
  },
  {
    schema: listInstructorMcpCapabilitiesTool,
    lifecycle: "production",
    enabledContexts: ["admin"],
    statusNote:
      "Exploration manifest for future remote MCP integrations across instructor-facing workflows.",
  },
  {
    schema: codeInterpreterTool,
    lifecycle: "production",
    enabledContexts: ["admin"],
    statusNote:
      "Admin-only built-in analysis tool. Never expose by default in student chat.",
  },
];

type ToolCatalogOptions = {
  context?: MichaelToolContext;
  includeExperimental?: boolean;
  includeDisabled?: boolean;
};

const LAST_COURSE_WEEK = Math.max(...Object.keys(SQL_CURRICULUM_MAP).map((week) => Number(week)));

function matchesContext(entry: ToolCatalogEntry, context?: MichaelToolContext) {
  return !context || entry.enabledContexts.includes(context);
}

function matchesLifecycle(
  entry: ToolCatalogEntry,
  includeExperimental: boolean,
  includeDisabled: boolean
) {
  if (entry.lifecycle === "production") {
    return true;
  }
  if (entry.lifecycle === "experimental") {
    return includeExperimental;
  }
  return includeDisabled;
}

export function getToolName(tool: MichaelToolDefinition): string {
  return tool.type === "function" ? tool.name : tool.type;
}

export function getToolCatalog(options: ToolCatalogOptions = {}): ToolCatalogEntry[] {
  const {
    context,
    includeExperimental = false,
    includeDisabled = false,
  } = options;

  return TOOL_CATALOG.filter(
    (entry) =>
      matchesContext(entry, context) &&
      matchesLifecycle(entry, includeExperimental, includeDisabled)
  );
}

export function getToolSchemas(options: ToolCatalogOptions = {}): MichaelToolDefinition[] {
  return getToolCatalog(options).map((entry) => entry.schema);
}

export const SHARED_TOOL_SCHEMAS: MichaelToolDefinition[] = getToolSchemas();

function inferSqlType(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "INT" : "FLOAT";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  return "VARCHAR(255)";
}

function normalizeSql(query: string): string {
  return query.replace(/;+\s*$/g, "").trim();
}

function containsDangerousSql(query: string): boolean {
  const upperQuery = query.toUpperCase();
  const dangerousKeywords = [
    "DROP",
    "DELETE",
    "TRUNCATE",
    "ALTER",
    "CREATE",
    "INSERT",
    "UPDATE",
    "MERGE",
    "GRANT",
    "REVOKE",
  ];

  if (dangerousKeywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(upperQuery))) {
    return true;
  }

  // Multiple statements are rejected even if each is SELECT.
  return /;.+\S/.test(query);
}

function isReadOnlyQuery(query: string): boolean {
  return /^(SELECT|WITH)\b/i.test(query);
}

function summarizeOutputPreview(rows: SqlResultRow[]): string {
  if (!rows.length) {
    return "No rows returned.";
  }
  return JSON.stringify(rows.slice(0, 3));
}

async function initializeExamplesDatabase() {
  const alasqlModule = await import("../alasql-server.cjs");
  const alasql = alasqlModule.default ?? alasqlModule;

  for (const table of demoDatabase.tables) {
    alasql(`DROP TABLE IF EXISTS ${table.name}`);
    const columnsSql = table.columns
      .map((column) => {
        const sampleValue = table.rows[0]?.[column];
        return `${column} ${inferSqlType(sampleValue)}`;
      })
      .join(", ");

    alasql(`CREATE TABLE ${table.name} (${columnsSql})`);
    for (const row of table.rows) {
      const values = table.columns.map((column) => row[column]);
      const placeholders = table.columns.map(() => "?").join(", ");
      alasql(`INSERT INTO ${table.name} VALUES (${placeholders})`, values);
    }
  }

  return alasql;
}

async function initializePracticeDatabase(practiceId?: string) {
  const alasqlModule = await import("../alasql-server.cjs");
  const alasql = alasqlModule.default ?? alasqlModule;
  const practiceTables = await getPracticeTables();
  const targetPracticeIds = practiceId ? [practiceId] : Object.keys(practiceTables);

  for (const id of targetPracticeIds) {
    const tables = practiceTables[id] || [];
    for (const table of tables) {
      if (typeof table.fullSql === "string" && table.fullSql.trim()) {
        alasql(table.fullSql);
      }
    }
  }

  return {
    alasql,
    availablePracticeIds: targetPracticeIds,
  };
}

function filterTablesByPattern<T extends { name?: string; table?: string }>(
  tables: T[],
  pattern?: string | null
): T[] {
  if (!pattern) {
    return tables;
  }

  try {
    const regex = new RegExp(pattern, "i");
    return tables.filter((table) => regex.test(String(table.name || table.table || "")));
  } catch {
    return tables;
  }
}

async function buildPracticeSchema(
  includeRelationships: boolean,
  tablePattern?: string | null,
  practiceId?: string | null
) {
  const groupedTables = await getPracticeTables();
  const relevantEntries = practiceId
    ? Object.entries(groupedTables).filter(([id]) => id === practiceId)
    : Object.entries(groupedTables);
  const flattenedTables = relevantEntries.flatMap(([resolvedPracticeId, tables]) =>
    tables.map((table) => ({
      practiceId: resolvedPracticeId,
      name: table.table,
      columns: (table.columns || []).map((column) => ({ name: column, type: "UNKNOWN" })),
      constraints: table.constraints || [],
      sourceSql: table.fullSql || null,
    }))
  );

  const filteredTables = filterTablesByPattern(flattenedTables, tablePattern);
  return {
    database: "practice",
    source: "practice_collections",
    practiceSets: relevantEntries.map(([id]) => id),
    tables: filteredTables,
    relationships: includeRelationships ? [] : undefined,
    notes: [
      "Practice schemas come from configured course practice sets.",
      "Use the practiceId field to understand which exercise a table belongs to.",
    ],
  };
}

function buildExamplesSchema(includeRelationships: boolean, tablePattern?: string | null) {
  const tables = filterTablesByPattern(
    demoDatabase.tables.map((table) => ({
      name: table.name,
      columns: table.columns.map((column) => ({
        name: column,
        type: inferSqlType(table.rows[0]?.[column]),
      })),
      sampleRows: table.rows.slice(0, 3),
    })),
    tablePattern
  );

  return {
    database: "examples",
    source: "curated_demo_database",
    name: demoDatabase.name,
    tables,
    relationships: includeRelationships
      ? [
          { from: { table: "orders", column: "customer_id" }, to: { table: "customers", column: "id" } },
          { from: { table: "orders", column: "product_id" }, to: { table: "products", column: "id" } },
        ]
      : undefined,
  };
}

async function buildHomeworkSchema(
  homeworkSetId: string,
  includeRelationships: boolean,
  tablePattern?: string | null
) {
  const homework = await getHomeworkSetById(homeworkSetId);
  const questions = await getQuestionsByHomeworkSet(homeworkSetId);
  const tables = filterTablesByPattern(
    (homework?.selectedDatasetId
      ? [{ name: homework.selectedDatasetId, columns: [], source: "selected_dataset_id" }]
      : []
    ).map((table) => ({
      name: table.name,
      columns: table.columns,
      source: table.source,
    })),
    tablePattern
  );

  return {
    database: "homework",
    homeworkSetId,
    title: homework?.title || null,
    dueAt: homework?.dueAt || null,
    availableUntil: homework?.availableUntil || null,
    datasetId: homework?.selectedDatasetId || null,
    questionCount: questions.length,
    questionIds: questions.map((question) => question.id),
    tables,
    relationships: includeRelationships ? [] : undefined,
    notes: [
      "Homework schema lookups are scoped to a homework set.",
      "If dataset metadata is unavailable, rely on homework instructions and question wording.",
    ],
  };
}

function analyzeSqlHeuristics(query: string, learningLevel: string) {
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const upperQuery = normalizedQuery.toUpperCase();
  const suggestions: string[] = [];
  const warnings: string[] = [];

  if (/SELECT\s+\*/i.test(normalizedQuery)) {
    suggestions.push("Avoid SELECT * when teaching or reviewing query intent. Select only the needed columns.");
  }

  if ((upperQuery.match(/\bJOIN\b/g) || []).length >= 2) {
    suggestions.push("Break the query into table relationships first, then verify each JOIN condition explicitly.");
  }

  if (upperQuery.includes("ORDER BY") && !upperQuery.includes("LIMIT")) {
    suggestions.push("If the task only needs the top rows, combine ORDER BY with LIMIT/TOP to reduce scanned output.");
  }

  if (!upperQuery.includes("WHERE") && !upperQuery.includes("GROUP BY")) {
    warnings.push("This query scans the full dataset. Confirm whether the task really needs every row.");
  }

  if (upperQuery.includes("COUNT(") && !upperQuery.includes("GROUP BY") && upperQuery.includes(",")) {
    warnings.push("Aggregation mixed with non-aggregated columns may be invalid without GROUP BY.");
  }

  return {
    query: normalizedQuery,
    learningLevel,
    complexity:
      upperQuery.includes("JOIN") || upperQuery.includes("GROUP BY")
        ? "intermediate"
        : upperQuery.includes("UNION") || upperQuery.includes("SUBQUERY")
          ? "advanced"
          : "beginner",
    suggestions,
    warnings,
    score: Math.max(40, 100 - warnings.length * 20 - suggestions.length * 8),
  };
}

function extractQueryFeatures(query: string) {
  const normalized = normalizeSql(query);
  const upper = normalized.toUpperCase();
  const tableTokens = Array.from(upper.matchAll(/\b(?:FROM|JOIN)\s+([A-Z0-9_]+)/g)).map(
    (match) => match[1]
  );
  const keywords = ["JOIN", "GROUP BY", "HAVING", "ORDER BY", "WHERE", "COUNT(", "AVG(", "SUM(", "MIN(", "MAX("]
    .filter((keyword) => upper.includes(keyword));
  const selectColumns = /SELECT\s+(.+?)\s+FROM/i.exec(normalized)?.[1] || "";

  return {
    normalized,
    tableTokens,
    keywords,
    selectColumns,
  };
}

function getAccessibleDatabases(context: ToolExecutionContext): string[] {
  if (context.toolContext === "admin") {
    return ["examples", "practice", "homework"];
  }
  if (context.toolContext === "homework_runner") {
    return ["examples", "practice", "homework"];
  }
  return ["examples", "practice"];
}

function getResolvedHomeworkSetId(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): string | null {
  const explicit = typeof args.homework_set_id === "string" ? args.homework_set_id.trim() : "";
  if (explicit) {
    return explicit;
  }
  return context.homeworkSetId?.trim() || null;
}

function getResolvedStudentId(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): string | null {
  const explicit = typeof args.student_id === "string" ? args.student_id.trim() : "";
  if (explicit) {
    return explicit;
  }
  return context.studentId?.trim() || context.userEmail?.trim() || context.userId?.trim() || null;
}

const toolHandlers: Record<string, ToolHandler> = {
  async get_course_week_context(args) {
    const week = typeof args.week === "number" ? args.week : undefined;
    let payload = week
      ? await getWeekContextByNumberNormalized(week)
      : await getCurrentWeekContextNormalized(null);

    if (!week && payload.weekNumber && payload.weekNumber > LAST_COURSE_WEEK) {
      payload = await getWeekContextByNumberNormalized(LAST_COURSE_WEEK);
    }

    const weekNumber = payload.weekNumber;
    const allowedConcepts = weekNumber ? getAllowedConceptsForWeek(weekNumber) : [];
    const forbiddenConcepts = weekNumber ? getForbiddenConceptsForWeek(weekNumber) : [];

    return {
      weekNumber: payload.weekNumber,
      content: payload.content,
      dateRange: payload.dateRange,
      updatedAt: payload.updatedAt || null,
      updatedBy: payload.updatedBy || null,
      sqlRestrictions: {
        weekNumber,
        allowedConcepts,
        forbiddenConcepts,
      },
      fetchedAt: new Date().toISOString(),
    };
  },

  async execute_sql_query(args, context) {
    const query = String(args.query ?? "").trim();
    const database = String(args.database ?? "").trim();
    const explainPlan = Boolean(args.explain_plan);
    const educationalContext = String(args.educational_context ?? "").trim();
    const practiceId = typeof args.practice_id === "string" ? args.practice_id.trim() : undefined;
    const rowLimit = Math.min(Math.max(Number(args.row_limit || 25), 1), 100);
    const timeoutMs = Math.min(Math.max(Number(args.timeout_ms || 1500), 250), 5000);
    const accessibleDatabases = getAccessibleDatabases(context);

    if (!accessibleDatabases.includes(database)) {
      return {
        success: false,
        error: `Database "${database}" is not available in this tutoring context.`,
        accessibleDatabases,
        educationalNote:
          database === "homework"
            ? "Homework execution requires an active homework context so Michael does not leak assignment-specific data."
            : "This tutoring surface intentionally limits which schemas can be queried.",
      };
    }

    if (!query) {
      return {
        success: false,
        error: "Query is required.",
      };
    }

    const normalizedQuery = normalizeSql(query);
    if (containsDangerousSql(normalizedQuery) || !isReadOnlyQuery(normalizedQuery)) {
      return {
        success: false,
        error: "Only a single read-only SELECT query is allowed in the tutoring sandbox.",
        educationalHint:
          "Start with SELECT ... FROM ... and remove any CREATE, INSERT, UPDATE, DELETE, or multiple-statement syntax.",
      };
    }

    const startedAt = Date.now();

    if (database === "homework") {
      const homeworkSetId = getResolvedHomeworkSetId(args, context);
      if (!homeworkSetId) {
        return {
          success: false,
          error: "Homework execution requires homework_set_id or an active homework context.",
          educationalHint:
            "Ask the user which homework set this question belongs to, or stay in schema/explanation mode.",
        };
      }

      return {
        success: false,
        error:
          "Homework query execution is intentionally blocked here until a student-specific dataset is attached to the tutoring request.",
        homeworkSetId,
        educationalHint:
          "Use get_homework_context or get_database_schema to inspect the assignment safely, then guide the student without executing hidden homework data.",
      };
    }

    const queryPromise =
      database === "examples"
        ? initializeExamplesDatabase().then((alasql) => alasql(normalizedQuery) as SqlResultRow[])
        : initializePracticeDatabase(practiceId).then(({ alasql }) => alasql(normalizedQuery) as SqlResultRow[]);

    let rows: SqlResultRow[];
    try {
      rows = await Promise.race([
        queryPromise,
        new Promise<SqlResultRow[]>((_, reject) =>
          setTimeout(() => reject(new Error("Query timed out in the tutoring sandbox.")), timeoutMs)
        ),
      ]);
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to execute the query in the tutoring sandbox.",
        educationalHint:
          "Double-check table names, join conditions, and whether the query depends on homework-only data.",
      };
    }

    const limitedRows = rows.slice(0, rowLimit);
    const columns = limitedRows.length > 0 ? Object.keys(limitedRows[0]) : [];

    return {
      success: true,
      database,
      practiceId: database === "practice" ? practiceId || null : undefined,
      query: normalizedQuery,
      columns,
      rowCount: rows.length,
      results: limitedRows,
      truncated: rows.length > limitedRows.length,
      executionTimeMs: Date.now() - startedAt,
      educationalContext:
        educationalContext ||
        (database === "practice"
          ? "Executed against the practice schema sandbox."
          : "Executed against the curated examples database."),
      executionPlan: explainPlan
        ? {
            supported: false,
            note: "Detailed engine execution plans are not available in the in-memory tutoring sandbox.",
          }
        : undefined,
      learningHint:
        limitedRows.length === 0
          ? "No rows were returned. Re-check the WHERE clause, join keys, or whether aggregation collapsed the result."
          : undefined,
    };
  },

  async validate_sql_answer(args) {
    const studentQuery = String(args.student_query ?? "").trim();
    if (!studentQuery) {
      return {
        success: false,
        error: "student_query is required.",
      };
    }

    const features = extractQueryFeatures(studentQuery);
    const requiredTables = Array.isArray(args.required_tables)
      ? args.required_tables.map((value) => String(value).toUpperCase())
      : [];
    const requiredKeywords = Array.isArray(args.required_keywords)
      ? args.required_keywords.map((value) => String(value).toUpperCase())
      : [];
    const forbiddenKeywords = Array.isArray(args.forbidden_keywords)
      ? args.forbidden_keywords.map((value) => String(value).toUpperCase())
      : [];
    const allowedConcepts = Array.isArray(args.allowed_concepts)
      ? args.allowed_concepts.map((value) => String(value))
      : [];
    const forbiddenConcepts = Array.isArray(args.forbidden_concepts)
      ? args.forbidden_concepts.map((value) => String(value))
      : [];

    const issues: string[] = [];
    const strengths: string[] = [];

    if (!isReadOnlyQuery(studentQuery) || containsDangerousSql(studentQuery)) {
      issues.push("The answer is not a safe read-only SQL query.");
    } else {
      strengths.push("The query stays within a read-only tutoring-safe shape.");
    }

    for (const table of requiredTables) {
      if (!features.tableTokens.includes(table)) {
        issues.push(`Missing required table: ${table.toLowerCase()}.`);
      }
    }

    for (const keyword of requiredKeywords) {
      if (!features.normalized.toUpperCase().includes(keyword)) {
        issues.push(`Missing required SQL concept: ${keyword}.`);
      }
    }

    for (const keyword of forbiddenKeywords) {
      if (features.normalized.toUpperCase().includes(keyword)) {
        issues.push(`Uses forbidden SQL concept: ${keyword}.`);
      }
    }

    for (const concept of forbiddenConcepts) {
      if (features.normalized.toUpperCase().includes(concept.toUpperCase())) {
        issues.push(`Uses out-of-scope concept: ${concept}.`);
      }
    }

    if (allowedConcepts.length > 0 && issues.length === 0) {
      strengths.push(`The query stays inside the allowed concept set: ${allowedConcepts.join(", ")}.`);
    }

    const referenceQuery = String(args.reference_query ?? "").trim();
    if (referenceQuery) {
      const referenceFeatures = extractQueryFeatures(referenceQuery);
      if (referenceFeatures.tableTokens.join(",") === features.tableTokens.join(",")) {
        strengths.push("The answer touches the same core tables as the reference solution.");
      } else {
        issues.push("The answer uses a different table set than the reference solution.");
      }
    }

    const expectedColumns = Array.isArray(args.expected_columns)
      ? args.expected_columns.map((value) => String(value).toLowerCase())
      : [];
    if (expectedColumns.length > 0) {
      const loweredSelect = features.selectColumns.toLowerCase();
      const missingColumns = expectedColumns.filter((column) => !loweredSelect.includes(column));
      if (missingColumns.length > 0) {
        issues.push(`The SELECT list may be missing: ${missingColumns.join(", ")}.`);
      }
    }

    return {
      success: true,
      valid: issues.length === 0,
      issues,
      strengths,
      nextChecks:
        issues.length > 0
          ? [
              "Verify table names against the schema.",
              "Check whether each WHERE and JOIN condition matches the task wording.",
              "Confirm the result columns are exactly what the prompt asks for.",
            ]
          : ["Run the query on sample data and inspect whether the returned rows match the task."],
    };
  },

  async compare_sql_queries(args) {
    const studentQuery = String(args.student_query ?? "").trim();
    const referenceQuery = String(args.reference_query ?? "").trim();
    if (!studentQuery || !referenceQuery) {
      return {
        success: false,
        error: "student_query and reference_query are required.",
      };
    }

    const student = extractQueryFeatures(studentQuery);
    const reference = extractQueryFeatures(referenceQuery);
    const focus = String(args.focus ?? "all");
    const comparisons: string[] = [];

    if ((focus === "all" || focus === "correctness") && student.tableTokens.join(",") !== reference.tableTokens.join(",")) {
      comparisons.push("The queries use different table relationships, which may change correctness.");
    }

    if (focus === "all" || focus === "readability") {
      if (/SELECT\s+\*/i.test(studentQuery) && !/SELECT\s+\*/i.test(referenceQuery)) {
        comparisons.push("The student's query is less readable because it uses SELECT * instead of explicit columns.");
      }
      if ((student.keywords.includes("JOIN") ? 1 : 0) === 0 && reference.keywords.includes("JOIN")) {
        comparisons.push("The reference query makes joins explicit, which is usually easier to review and debug.");
      }
    }

    if (focus === "all" || focus === "efficiency") {
      if (!student.keywords.includes("WHERE") && reference.keywords.includes("WHERE")) {
        comparisons.push("The student's query may scan more rows because it lacks filtering present in the reference query.");
      }
      if (/ORDER BY/i.test(studentQuery) && !/LIMIT|TOP/i.test(studentQuery) && /LIMIT|TOP/i.test(referenceQuery)) {
        comparisons.push("The reference query is likely more efficient because it limits ordered output.");
      }
    }

    return {
      success: true,
      focus,
      studentSummary: {
        tables: student.tableTokens,
        keywords: student.keywords,
      },
      referenceSummary: {
        tables: reference.tableTokens,
        keywords: reference.keywords,
      },
      comparisons:
        comparisons.length > 0
          ? comparisons
          : ["The queries look broadly similar. Focus on running both and comparing row-level results."],
    };
  },

  async get_homework_context(args, context) {
    const homeworkSetId = getResolvedHomeworkSetId(args, context);
    const questionId = typeof args.question_id === "string" ? args.question_id.trim() : context.questionId || "";
    const includeQuestions = args.include_questions !== false;

    if (!homeworkSetId) {
      return {
        success: false,
        error: "homework_set_id is required unless an active homework context is already attached.",
      };
    }

    const homework = await getHomeworkSetById(homeworkSetId);
    if (!homework) {
      return {
        success: false,
        error: `Homework set not found: ${homeworkSetId}`,
      };
    }

    const questions = await getQuestionsByHomeworkSet(homeworkSetId);
    const selectedQuestion = questionId
      ? questions.find((question) => question.id === questionId) || null
      : null;

    return {
      success: true,
      homeworkSetId,
      title: homework.title,
      dueAt: homework.dueAt,
      availableUntil: homework.availableUntil || homework.dueAt,
      overview: homework.overview || null,
      backgroundStory: homework.backgroundStory || null,
      dataStructureNotes: homework.dataStructureNotes || null,
      datasetPolicy: homework.datasetPolicy,
      questionCount: questions.length,
      selectedQuestion,
      questions: includeQuestions
        ? questions.map((question, index) => ({
            id: question.id,
            index: index + 1,
            prompt: question.prompt,
            instructions: question.instructions,
            rubricHints: (question.gradingRubric || []).map((criterion) => criterion.label),
            points: question.points,
          }))
        : undefined,
    };
  },

  async get_student_learning_profile(args, context) {
    const studentId = getResolvedStudentId(args, context);
    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    const [profile, preferences] = await Promise.all([
      getStudentProfile(studentId),
      args.include_preferences === false ? Promise.resolve([]) : listStudentPreferences(studentId),
    ]);

    if (!profile) {
      return {
        success: true,
        studentId,
        exists: false,
        tutoringHints: [
          "Ask 1-2 quick calibration questions before going deep.",
          "Default to a beginner-friendly explanation until the student shows stronger fluency.",
        ],
        preferences,
      };
    }

    return {
      success: true,
      studentId,
      exists: true,
      knowledgeScore: profile.knowledgeScore,
      commonChallenges: profile.commonChallenges,
      learningProgress: profile.learningProgress,
      engagementMetrics: profile.engagementMetrics,
      riskFactors: profile.riskFactors,
      preferences,
      tutoringHints: [
        profile.knowledgeScore === "struggling"
          ? "Use shorter steps, simpler SQL, and frequent comprehension checks."
          : "You can keep explanations concise unless the student asks for more detail.",
        profile.commonChallenges.length > 0
          ? `Watch for recurring weak areas: ${profile.commonChallenges.join(", ")}.`
          : "No recurring weak areas are recorded yet.",
      ],
    };
  },

  async remember_student_preference(args, context) {
    const studentId = getResolvedStudentId(args, context);
    const key = String(args.preference_key ?? "").trim() as StudentPreferenceKey;
    const value = String(args.value ?? "").trim();
    const notes = typeof args.notes === "string" ? args.notes.trim() : undefined;

    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    if (!key || !value) {
      return {
        success: false,
        error: "preference_key and value are required.",
      };
    }

    const saved = await upsertStudentPreference({
      userId: studentId,
      key,
      value,
      notes,
      source: "assistant",
    });

    return {
      success: true,
      preference: {
        key: saved.key,
        value: saved.value,
        notes: saved.notes || null,
        updatedAt: saved.updatedAt,
      },
    };
  },

  async generate_next_practice_step(args) {
    const topic = String(args.topic ?? "general_sql").trim();
    const mistakeSummary = String(args.mistake_summary ?? "").trim();
    const currentLevel = String(args.current_level ?? "beginner").trim();
    const targetLanguage = String(args.target_language ?? "he").trim();

    const prompts =
      targetLanguage === "en"
        ? {
            intro: "Next practice step",
            coaching: "Try this focused exercise next",
          }
        : {
            intro: "שלב התרגול הבא",
            coaching: "נסו את התרגיל הממוקד הבא",
          };

    return {
      success: true,
      topic,
      currentLevel,
      title: prompts.intro,
      recommendation: {
        exercisePrompt:
          targetLanguage === "en"
            ? `Write one query about ${topic} that fixes this mistake: ${mistakeSummary || "missing filters or join logic"}.`
            : `כתבו שאילתה אחת בנושא ${topic} שמתקנת את הטעות הבאה: ${mistakeSummary || "חסר סינון או לוגיקת JOIN"}.`,
        coachingPrompt:
          targetLanguage === "en"
            ? `${prompts.coaching}: first list the required tables, then write the WHERE/JOIN conditions before writing SELECT.`
            : `${prompts.coaching}: קודם רשמו את הטבלאות הדרושות, אחר כך את תנאי ה-WHERE או ה-JOIN, ורק בסוף את ה-SELECT.`,
      },
    };
  },

  async get_database_schema(args, context) {
    const database = String(args.database ?? "").trim();
    const tablePattern = args.table_pattern ? String(args.table_pattern) : null;
    const includeRelationships = args.include_relationships !== false;
    const practiceId = args.practice_id ? String(args.practice_id) : null;

    if (database === "examples") {
      return buildExamplesSchema(includeRelationships, tablePattern);
    }

    if (database === "practice") {
      try {
        return await buildPracticeSchema(includeRelationships, tablePattern, practiceId);
      } catch (error: any) {
        return {
          success: false,
          database,
          error: error?.message || "Failed to read practice schema metadata.",
        };
      }
    }

    const homeworkSetId = getResolvedHomeworkSetId(args, context);
    if (!homeworkSetId) {
      return {
        success: false,
        database,
        error: "Homework schema lookup requires homework_set_id or an active homework context.",
        educationalNote:
          "Use the homework runner context or uploaded course materials when answering assignment-specific questions.",
      };
    }

    try {
      return await buildHomeworkSchema(homeworkSetId, includeRelationships, tablePattern);
    } catch (error: any) {
      return {
        success: false,
        database,
        error: error?.message || "Failed to read homework schema metadata.",
      };
    }
  },

  async analyze_query_performance(args) {
    const query = String(args.query ?? "").trim();
    const learningLevel = String(args.learning_level ?? "intermediate");

    if (!query) {
      return {
        success: false,
        error: "Query is required.",
      };
    }

    const analysis = analyzeSqlHeuristics(query, learningLevel);
    return {
      success: true,
      query: analysis.query,
      performanceScore: analysis.score,
      complexityLevel: analysis.complexity,
      optimizationSuggestions: analysis.suggestions,
      warnings: analysis.warnings,
      note: "This is a heuristic teaching aid. It is not a database-engine execution plan.",
    };
  },

  async render_sql_visualization(args) {
    const query = String(args.query ?? "").trim();
    if (!query) {
      return {
        success: false,
        error: "query is required.",
      };
    }

    const features = extractQueryFeatures(query);
    const resultPreview = Array.isArray(args.result_preview)
      ? (args.result_preview as SqlResultRow[]).slice(0, 5)
      : [];

    return {
      success: true,
      contractVersion: 1,
      query: normalizeSql(query),
      tables: features.tableTokens.map((table) => ({ name: table.toLowerCase() })),
      joins: Array.from(query.matchAll(/\bJOIN\s+([a-zA-Z0-9_]+)\b/gi)).map((match) => ({
        table: match[1],
      })),
      filters: Array.from(query.matchAll(/\bWHERE\s+(.+?)(?:GROUP BY|ORDER BY|HAVING|$)/i)).map((match) => ({
        expression: match[1].trim(),
      })),
      aggregations: ["COUNT(", "AVG(", "SUM(", "MIN(", "MAX("]
        .filter((keyword) => features.normalized.toUpperCase().includes(keyword))
        .map((keyword) => keyword.replace("(", "")),
      resultPreview: {
        rowCount: resultPreview.length,
        preview: resultPreview,
        summary: summarizeOutputPreview(resultPreview),
      },
    };
  },

  async list_instructor_mcp_capabilities() {
    return {
      success: true,
      capabilities: [
        {
          connector: "Google Drive",
          useCases: ["lecture PDFs", "course notes", "shared admin folders"],
          value: "Lets Michael ground answers in official course documents without copying them into code.",
        },
        {
          connector: "Google Sheets",
          useCases: ["rubrics", "gradebooks", "office hours tracking"],
          value: "Useful for instructor analytics and rubric-backed feedback workflows.",
        },
        {
          connector: "Notion",
          useCases: ["FAQ", "policy notes", "teaching playbooks"],
          value: "Good fit for staff-maintained knowledge bases and tutoring guardrails.",
        },
      ],
      recommendation:
        "Start with Drive for retrieval, then add Sheets or Notion only for instructor-facing flows where authenticated admin access is acceptable.",
    };
  },
};

export async function executeToolCall(
  request: ToolCallRequest,
  context: ToolExecutionContext = {}
): Promise<string> {
  const handler = toolHandlers[request.name];
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${request.name}` });
  }

  let args: Record<string, unknown> = {};
  if (request.argumentsJson) {
    try {
      args = JSON.parse(request.argumentsJson);
    } catch (_error) {
      return JSON.stringify({ error: "Invalid tool arguments JSON" });
    }
  }

  try {
    const result = await handler(args, context);
    return JSON.stringify(result);
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error?.message || `Tool ${request.name} failed.`,
    });
  }
}
