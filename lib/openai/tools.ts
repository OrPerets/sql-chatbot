import { demoDatabase } from "@/app/visualizer/mock-schema";
import { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } from "@/lib/content";
import { getPracticeTables } from "@/lib/practice";
import { ToolCallRequest } from "@/lib/openai/contracts";
import {
  SQL_CURRICULUM_MAP,
  getAllowedConceptsForWeek,
  getForbiddenConceptsForWeek,
} from "@/lib/sql-curriculum";

type JsonSchema = Record<string, unknown>;

export type ResponsesToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
};

export type ToolLifecycle = "production" | "experimental" | "disabled";
export type MichaelToolContext = "main_chat" | "homework_runner" | "admin" | "voice";

export type ToolCatalogEntry = {
  schema: ResponsesToolDefinition;
  lifecycle: ToolLifecycle;
  enabledContexts: MichaelToolContext[];
  statusNote?: string;
};

const getCourseWeekContextTool: ResponsesToolDefinition = {
  type: "function",
  name: "get_course_week_context",
  description:
    "Return the active SQL course week context, plus allowed and forbidden SQL concepts.",
  parameters: {
    type: "object",
    description:
      "No arguments. Always resolves by current academic week (and after semester end, resolves to the last curriculum week).",
    properties: {},
    additionalProperties: false,
  },
};

const executeSqlQueryTool: ResponsesToolDefinition = {
  type: "function",
  name: "execute_sql_query",
  description:
    "Execute a read-only SQL query against the approved educational examples database. Other database contexts may be unavailable in tutor chat.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      database: { type: "string", enum: ["practice", "examples", "homework"] },
      explain_plan: { type: "boolean" },
      educational_context: { type: "string" },
    },
    required: ["query", "database"],
    additionalProperties: false,
  },
};

const getDatabaseSchemaTool: ResponsesToolDefinition = {
  type: "function",
  name: "get_database_schema",
  description:
    "Return schema metadata for approved educational SQL database contexts, including practice tables and curated example schemas.",
  parameters: {
    type: "object",
    properties: {
      database: { type: "string", enum: ["practice", "examples", "homework"] },
      table_pattern: { type: "string" },
      include_relationships: { type: "boolean" },
    },
    required: ["database"],
    additionalProperties: false,
  },
};

const analyzeQueryPerformanceTool: ResponsesToolDefinition = {
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
};

const getWeatherTool: ResponsesToolDefinition = {
  type: "function",
  name: "get_weather",
  description: "Deprecated non-product tool. Disabled for Michael.",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string" },
      unit: { type: "string", enum: ["c", "f"] },
    },
    required: ["location"],
    additionalProperties: false,
  },
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
    statusNote: "Uses real practice metadata and curated examples data. Homework schemas require an active homework context.",
  },
  {
    schema: executeSqlQueryTool,
    lifecycle: "experimental",
    enabledContexts: ["admin"],
    statusNote:
      "Safely limited to examples-mode execution until a scoped student/homework query context is available.",
  },
  {
    schema: analyzeQueryPerformanceTool,
    lifecycle: "experimental",
    enabledContexts: ["admin"],
    statusNote: "Provides heuristic teaching feedback, not database-engine query plans.",
  },
  {
    schema: getWeatherTool,
    lifecycle: "disabled",
    enabledContexts: [],
    statusNote: "Removed from Michael. Outside product scope.",
  },
];

type ToolCatalogOptions = {
  context?: MichaelToolContext;
  includeExperimental?: boolean;
  includeDisabled?: boolean;
};

type ToolExecutionResult = unknown;
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolExecutionResult>;

const LAST_COURSE_WEEK = Math.max(...Object.keys(SQL_CURRICULUM_MAP).map((week) => Number(week)));

function matchesContext(entry: ToolCatalogEntry, context?: MichaelToolContext) {
  return !context || entry.enabledContexts.includes(context);
}

function matchesLifecycle(entry: ToolCatalogEntry, includeExperimental: boolean, includeDisabled: boolean) {
  if (entry.lifecycle === "production") {
    return true;
  }
  if (entry.lifecycle === "experimental") {
    return includeExperimental;
  }
  return includeDisabled;
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

export function getToolSchemas(options: ToolCatalogOptions = {}): ResponsesToolDefinition[] {
  return getToolCatalog(options).map((entry) => entry.schema);
}

export const SHARED_TOOL_SCHEMAS: ResponsesToolDefinition[] = getToolSchemas();

function inferSqlType(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "INT" : "FLOAT";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  return "VARCHAR(255)";
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

async function buildPracticeSchema(includeRelationships: boolean, tablePattern?: string | null) {
  const groupedTables = await getPracticeTables();
  const flattenedTables = Object.entries(groupedTables).flatMap(([practiceId, tables]) =>
    tables.map((table) => ({
      practiceId,
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
    practiceSets: Object.keys(groupedTables),
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

  async execute_sql_query(args) {
    const query = String(args.query ?? "").trim();
    const database = String(args.database ?? "").trim();
    const explainPlan = Boolean(args.explain_plan);
    const educationalContext = String(args.educational_context ?? "").trim();
    const allowedDatabases = ["practice", "examples", "homework"];

    if (!allowedDatabases.includes(database)) {
      return {
        success: false,
        error: `Invalid database. Allowed databases: ${allowedDatabases.join(", ")}`,
      };
    }

    if (!query) {
      return {
        success: false,
        error: "Query is required.",
      };
    }

    const normalizedQuery = query.replace(/;+\s*$/g, "").trim();
    const upperQuery = normalizedQuery.toUpperCase();
    const dangerousKeywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "CREATE", "INSERT", "UPDATE"];
    const containsDangerous = dangerousKeywords.some((keyword) => upperQuery.includes(keyword));

    if (containsDangerous || !upperQuery.startsWith("SELECT")) {
      return {
        success: false,
        error: "Only read-only SELECT queries are allowed in Michael tools.",
        educationalNote: "Use the homework runner or SQL practice flow for student-specific execution contexts.",
      };
    }

    if (database !== "examples") {
      return {
        success: false,
        error: `Database "${database}" is not available for direct execution in Michael chat.`,
        supportedDatabase: "examples",
        educationalNote:
          "Practice and homework datasets require a scoped student or assignment context, so the tool stays hidden from default chat.",
      };
    }

    const startedAt = Date.now();
    const alasql = await initializeExamplesDatabase();
    const rows = alasql(normalizedQuery) as Array<Record<string, unknown>>;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      success: true,
      database,
      source: demoDatabase.name,
      query: normalizedQuery,
      columns,
      results: rows,
      row_count: rows.length,
      execution_time_ms: Date.now() - startedAt,
      educational_context:
        educationalContext || "Executed against the curated examples database only.",
      execution_plan: explainPlan
        ? {
            supported: false,
            note: "Detailed execution plans are not available in the in-memory examples engine.",
          }
        : undefined,
    };
  },

  async get_database_schema(args) {
    const database = String(args.database ?? "").trim();
    const tablePattern = args.table_pattern ? String(args.table_pattern) : null;
    const includeRelationships = args.include_relationships !== false;

    if (database === "examples") {
      return buildExamplesSchema(includeRelationships, tablePattern);
    }

    if (database === "practice") {
      try {
        return await buildPracticeSchema(includeRelationships, tablePattern);
      } catch (error: any) {
        return {
          success: false,
          database,
          error: error?.message || "Failed to read practice schema metadata.",
        };
      }
    }

    return {
      success: false,
      database,
      error: "Homework schema lookup requires an active homework or student context.",
      educationalNote:
        "Use the homework runner context or uploaded course materials when answering assignment-specific questions.",
    };
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
      performance_score: analysis.score,
      complexity_level: analysis.complexity,
      optimization_suggestions: analysis.suggestions,
      warnings: analysis.warnings,
      note: "This is a heuristic teaching aid. It is not a database-engine execution plan.",
    };
  },

  async get_weather(args) {
    return {
      success: false,
      error: "get_weather is disabled for Michael.",
      requested: args,
    };
  },
};

export async function executeToolCall(request: ToolCallRequest): Promise<string> {
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

  const result = await handler(args);
  return JSON.stringify(result);
}
