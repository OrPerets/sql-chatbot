import { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } from "@/lib/content";
import {
  SQL_CURRICULUM_MAP,
  getAllowedConceptsForWeek,
  getForbiddenConceptsForWeek,
} from "@/lib/sql-curriculum";
import { ToolCallRequest } from "@/lib/openai/contracts";

type JsonSchema = Record<string, unknown>;

export type ResponsesToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
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
  description: "Run a safe SQL query against an approved educational database context.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      database: { type: "string", enum: ["practice", "examples", "homework"] },
      explain_plan: { type: "boolean" },
      educational_context: { type: "string" },
    },
    required: ["query", "database"],
  },
};

const getDatabaseSchemaTool: ResponsesToolDefinition = {
  type: "function",
  name: "get_database_schema",
  description: "Return schema metadata for the selected educational SQL database.",
  parameters: {
    type: "object",
    properties: {
      database: { type: "string", enum: ["practice", "examples", "homework"] },
      table_pattern: { type: "string" },
      include_relationships: { type: "boolean" },
    },
    required: ["database"],
  },
};

const analyzeQueryPerformanceTool: ResponsesToolDefinition = {
  type: "function",
  name: "analyze_query_performance",
  description: "Analyze a SQL query and return optimization hints for students.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      database_context: { type: "object" },
      learning_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    },
    required: ["query"],
  },
};

const getWeatherTool: ResponsesToolDefinition = {
  type: "function",
  name: "get_weather",
  description: "Determine weather in a location.",
  parameters: {
    type: "object",
    properties: {
      location: { type: "string" },
      unit: { type: "string", enum: ["c", "f"] },
    },
    required: ["location"],
  },
};

export const SHARED_TOOL_SCHEMAS: ResponsesToolDefinition[] = [
  getCourseWeekContextTool,
  executeSqlQueryTool,
  getDatabaseSchemaTool,
  analyzeQueryPerformanceTool,
  getWeatherTool,
];

type ToolExecutionResult = unknown;
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolExecutionResult>;
const LAST_COURSE_WEEK = Math.max(...Object.keys(SQL_CURRICULUM_MAP).map((week) => Number(week)));

const toolHandlers: Record<string, ToolHandler> = {
  async get_course_week_context(args) {
    const week = typeof args.week === "number" ? args.week : undefined;
    let payload = week
      ? await getWeekContextByNumberNormalized(week)
      : await getCurrentWeekContextNormalized(null);

    // If current date is after the semester's final curriculum week, pin context to
    // the last curriculum week so the assistant can use all taught concepts.
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
    const query = String(args.query ?? "");
    const database = String(args.database ?? "");
    const explainPlan = Boolean(args.explain_plan);
    const educationalContext = String(args.educational_context ?? "");
    const allowedDatabases = ["practice", "examples", "homework"];

    if (!allowedDatabases.includes(database)) {
      return {
        success: false,
        error: `Invalid database. Allowed databases: ${allowedDatabases.join(", ")}`,
      };
    }

    const dangerousKeywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "CREATE", "INSERT", "UPDATE"];
    const upperQuery = query.toUpperCase();
    const containsDangerous = dangerousKeywords.some((keyword) => upperQuery.includes(keyword));

    if (containsDangerous) {
      return {
        success: false,
        error: "Query contains potentially dangerous operations",
        suggestion: "Use SELECT statements in this educational environment.",
      };
    }

    const result: Record<string, unknown> = {
      success: true,
      query,
      database,
      results: [
        { id: 1, name: "Sample Data", created_at: "2024-01-01" },
        { id: 2, name: "Example Record", created_at: "2024-01-02" },
      ],
      row_count: 2,
      execution_time: "0.045s",
      educational_context: educationalContext || "Query execution completed successfully",
    };

    if (explainPlan) {
      result.execution_plan = {
        operation: "Table Scan",
        cost: "0.1",
        rows_examined: 100,
      };
    }

    return result;
  },
  async get_database_schema(args) {
    const database = String(args.database ?? "");
    const tablePattern = args.table_pattern ? String(args.table_pattern) : null;
    const includeRelationships = args.include_relationships !== false;
    const schema: Record<string, unknown> = {
      database,
      tables: [
        { name: "students", columns: [{ name: "id", type: "INT" }, { name: "name", type: "VARCHAR(255)" }] },
        { name: "courses", columns: [{ name: "id", type: "INT" }, { name: "title", type: "VARCHAR(255)" }] },
        {
          name: "enrollments",
          columns: [
            { name: "id", type: "INT" },
            { name: "student_id", type: "INT" },
            { name: "course_id", type: "INT" },
          ],
        },
      ],
    };

    if (tablePattern) {
      const regex = new RegExp(tablePattern, "i");
      schema.tables = (schema.tables as any[]).filter((table) => regex.test(table.name));
    }

    if (includeRelationships) {
      schema.relationships = [
        { table: "enrollments", column: "student_id", references: { table: "students", column: "id" } },
        { table: "enrollments", column: "course_id", references: { table: "courses", column: "id" } },
      ];
    }

    return schema;
  },
  async analyze_query_performance(args) {
    const query = String(args.query ?? "");
    const learningLevel = String(args.learning_level ?? "intermediate");
    return {
      query,
      performance_score: 75,
      complexity_level: learningLevel,
      optimization_suggestions: [
        "Add indexes for columns used in WHERE clauses.",
        "Avoid SELECT * when only a few columns are needed.",
      ],
    };
  },
  async get_weather(args) {
    return {
      note: "Weather integration is not implemented in this backend.",
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
