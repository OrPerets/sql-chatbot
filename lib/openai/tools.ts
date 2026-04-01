import { demoDatabase } from "@/app/visualizer/mock-schema";
import type { SqlResultRow } from "@/app/homework/types";
import { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } from "@/lib/content";
import { getHomeworkSetById } from "@/lib/homework";
import { ToolCallRequest } from "@/lib/openai/contracts";
import { listInstructorConnectorCapabilities } from "@/lib/openai/instructor-connectors";
import { gradeWithRubric } from "@/lib/openai/rubric-grader";
import { getPracticeTables } from "@/lib/practice";
import {
  generatePersonalizedQuizFromMistakes,
  getDeadlineAndScheduleContext,
  getRecentSubmissionAttempts,
  getStudentProgressSnapshot,
  recommendNextLearningStep,
} from "@/lib/personalization";
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
import {
  OpenAIFeatureFlagName,
  getOpenAIFeatureFlag,
  getOpenAIFeatureFlags,
} from "@/lib/openai/feature-flags";

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

export type WebSearchToolDefinition = {
  type: "web_search";
  search_context_size?: "low" | "medium" | "high";
};

export type MichaelToolDefinition =
  | FunctionToolDefinition
  | CodeInterpreterToolDefinition
  | WebSearchToolDefinition;

export type ToolLifecycle = "production" | "experimental" | "disabled";
export type MichaelToolContext = "main_chat" | "homework_runner" | "admin" | "voice";
export type MichaelToolRole = "student" | "instructor" | "admin";
export type ToolRolloutPhase = "general_availability" | "admin_only" | "internal";
export type ToolLoggingSensitivity = "standard" | "sensitive" | "restricted";

export type ToolCatalogEntry = {
  schema: MichaelToolDefinition;
  lifecycle: ToolLifecycle;
  enabledContexts: MichaelToolContext[];
  allowedRoles: MichaelToolRole[];
  rolloutPhase: ToolRolloutPhase;
  loggingSensitivity: ToolLoggingSensitivity;
  featureFlag?: OpenAIFeatureFlagName;
  statusNote?: string;
};

export type ToolExecutionContext = {
  toolContext?: MichaelToolContext;
  userRole?: MichaelToolRole;
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

function isJsonSchema(value: unknown): value is JsonSchema {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function makeSchemaNullable(schema: JsonSchema): JsonSchema {
  const type = schema.type;
  const enumValues = Array.isArray(schema.enum) ? schema.enum : undefined;

  if (Array.isArray(type)) {
    return {
      ...schema,
      type: type.includes("null") ? type : [...type, "null"],
      ...(enumValues && !enumValues.includes(null) ? { enum: [...enumValues, null] } : {}),
    };
  }

  if (typeof type === "string") {
    return {
      ...schema,
      type: type === "null" ? ["null"] : [type, "null"],
      ...(enumValues && !enumValues.includes(null) ? { enum: [...enumValues, null] } : {}),
    };
  }

  if (enumValues && !enumValues.includes(null)) {
    return {
      ...schema,
      enum: [...enumValues, null],
    };
  }

  if (Array.isArray(schema.anyOf)) {
    const hasNullVariant = schema.anyOf.some(
      (variant) => isJsonSchema(variant) && variant.type === "null"
    );
    return hasNullVariant
      ? schema
      : { ...schema, anyOf: [...schema.anyOf, { type: "null" }] };
  }

  return {
    anyOf: [schema, { type: "null" }],
  };
}

function normalizeStrictJsonSchema(schema: JsonSchema): JsonSchema {
  const normalized: JsonSchema = { ...schema };
  const type = schema.type;
  const isObjectType =
    type === "object" || (Array.isArray(type) && type.includes("object")) || isJsonSchema(schema.properties);

  if (isJsonSchema(schema.items)) {
    normalized.items = normalizeStrictJsonSchema(schema.items);
  }

  if (isJsonSchema(schema.additionalProperties)) {
    normalized.additionalProperties = normalizeStrictJsonSchema(schema.additionalProperties);
  }

  if (Array.isArray(schema.anyOf)) {
    normalized.anyOf = schema.anyOf.map((variant) =>
      isJsonSchema(variant) ? normalizeStrictJsonSchema(variant) : variant
    );
  }

  const properties = isJsonSchema(schema.properties)
    ? (schema.properties as Record<string, unknown>)
    : isObjectType
      ? {}
      : null;

  if (!properties) {
    return normalized;
  }

  const existingRequired = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((key): key is string => typeof key === "string")
      : []
  );

  normalized.properties = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      if (!isJsonSchema(value)) {
        return [key, value];
      }

      const normalizedProperty = normalizeStrictJsonSchema(value);
      return [key, existingRequired.has(key) ? normalizedProperty : makeSchemaNullable(normalizedProperty)];
    })
  );
  normalized.required = Object.keys(properties);
  normalized.additionalProperties = false;

  return normalized;
}

function normalizeToolSchema(tool: MichaelToolDefinition): MichaelToolDefinition {
  if (tool.type !== "function" || !tool.strict || !isJsonSchema(tool.parameters)) {
    return tool;
  }

  return {
    ...tool,
    parameters: normalizeStrictJsonSchema(tool.parameters),
  };
}

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

const getStudentProgressSnapshotTool: FunctionToolDefinition = {
  type: "function",
  name: "get_student_progress_snapshot",
  description:
    "Return a sanitized summary of the student's current progress, weak areas, quiz trend, engagement, and risk signals.",
  parameters: {
    type: "object",
    properties: {
      student_id: { type: "string" },
      homework_set_id: { type: "string" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const getRecentSubmissionAttemptsTool: FunctionToolDefinition = {
  type: "function",
  name: "get_recent_submission_attempts",
  description:
    "Return recent question-level attempt summaries derived from current submissions and question analytics.",
  parameters: {
    type: "object",
    properties: {
      student_id: { type: "string" },
      homework_set_id: { type: "string" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const getDeadlineAndScheduleContextTool: FunctionToolDefinition = {
  type: "function",
  name: "get_deadline_and_schedule_context",
  description:
    "Return the student's current homework deadline context plus nearby same-course deadlines when a homework set is available.",
  parameters: {
    type: "object",
    properties: {
      student_id: { type: "string" },
      homework_set_id: { type: "string" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const recommendNextLearningStepTool: FunctionToolDefinition = {
  type: "function",
  name: "recommend_next_learning_step",
  description:
    "Return a deterministic next-step recommendation based on recent attempts, weak topics, quiz results, and deadline pressure.",
  parameters: {
    type: "object",
    properties: {
      student_id: { type: "string" },
      homework_set_id: { type: "string" },
      question_id: { type: "string" },
    },
    additionalProperties: false,
  },
  strict: true,
};

const generatePersonalizedQuizFromMistakesTool: FunctionToolDefinition = {
  type: "function",
  name: "generate_personalized_quiz_from_mistakes",
  description:
    "Generate and persist a short personalized review quiz from the student's repeated mistake themes.",
  parameters: {
    type: "object",
    properties: {
      student_id: { type: "string" },
      homework_set_id: { type: "string" },
      question_id: { type: "string" },
      max_questions: { type: "number" },
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

const explainRelationalAlgebraStepTool: FunctionToolDefinition = {
  type: "function",
  name: "explain_relational_algebra_step",
  description:
    "Map SQL or relational algebra into step-by-step relational algebra explanations with course-appropriate notation, operator meaning, and examples.",
  parameters: {
    type: "object",
    properties: {
      input_expression: { type: "string" },
      source_language: {
        type: "string",
        enum: ["sql", "relational_algebra", "auto"],
      },
      target_language: {
        type: "string",
        enum: ["he", "en"],
      },
      include_examples: { type: "boolean" },
    },
    required: ["input_expression"],
    additionalProperties: false,
  },
  strict: true,
};


const gradeWithRubricTool: FunctionToolDefinition = {
  type: "function",
  name: "grade_with_rubric",
  description:
    "Evaluate a student response using weighted rubric dimensions and return structured scores, rationale, correction guidance, and review-required flags.",
  parameters: {
    type: "object",
    properties: {
      rubric: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            weight: { type: "number" },
            criteria: { type: "string" },
            examples: { type: "array", items: { type: "string" } },
          },
          required: ["id", "label", "weight", "criteria"],
          additionalProperties: false,
        },
      },
      student_response: { type: "string" },
      assignment_context: { type: "string" },
    },
    required: ["rubric", "student_response"],
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

const webSearchTool: WebSearchToolDefinition = {
  type: "web_search",
  search_context_size: "medium",
};

export const TOOL_CONTEXT_BOUNDARIES: Record<
  MichaelToolContext,
  {
    purpose: string;
    webSearchAllowed: boolean;
    notes: string[];
  }
> = {
  main_chat: {
    purpose: "Student-facing tutoring and SQL explanation.",
    webSearchAllowed: false,
    notes: [
      "Prefer course files, SQL tools, and retrieval over external sources.",
      "Keep answers scoped to safe educational guidance.",
    ],
  },
  homework_runner: {
    purpose: "Hint-first homework guidance inside the runner.",
    webSearchAllowed: false,
    notes: [
      "Never introduce web-connected tools into grading or homework solving flows.",
      "Guide students without bypassing assignment constraints.",
    ],
  },
  admin: {
    purpose: "Instructor and admin diagnostics, ops, and grounded research workflows.",
    webSearchAllowed: true,
    notes: [
      "Prefer internal files for course truth and canonical policy answers.",
      "Allow web search only for fresh, external, or documentation-style questions.",
    ],
  },
  voice: {
    purpose: "Low-latency voice interaction with tightly-scoped educational tooling.",
    webSearchAllowed: false,
    notes: [
      "Keep tool usage narrow to preserve latency and avoid noisy multimodal side effects.",
    ],
  },
};

export const TOOL_USAGE_LOGGING_PLAN = {
  destination: "app_logs_and_mongo_audit_logs",
  notes: [
    "Hosted tool usage is logged to structured app logs for fast debugging.",
    "Sensitive hosted-tool events are mirrored into Mongo audit logs for admin review.",
    "Custom function-call outputs remain truncated in metadata previews to reduce data exposure.",
  ],
} as const;

const TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    schema: getCourseWeekContextTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin", "voice"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
  },
  {
    schema: getDatabaseSchemaTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
    statusNote:
      "Uses real practice metadata and homework-set metadata when a homework context is available.",
  },
  {
    schema: executeSqlQueryTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    statusNote:
      "Student-safe sandbox only. Read-only queries, scoped schemas, row limits, and friendly tutoring errors are enforced.",
  },
  {
    schema: validateSqlAnswerTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
  },
  {
    schema: compareSqlQueriesTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
  },
  {
    schema: getHomeworkContextTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
  },
  {
    schema: getStudentLearningProfileTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: getStudentProgressSnapshotTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: getRecentSubmissionAttemptsTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: getDeadlineAndScheduleContextTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: recommendNextLearningStepTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: generatePersonalizedQuizFromMistakesTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: rememberStudentPreferenceTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: generateNextPracticeStepTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
    featureFlag: "FEATURE_PERSONALIZATION_TOOLS",
  },
  {
    schema: analyzeQueryPerformanceTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
  },
  {
    schema: renderSqlVisualizationTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
  },
  {
    schema: explainRelationalAlgebraStepTool,
    lifecycle: "production",
    enabledContexts: ["main_chat", "homework_runner", "admin"],
    allowedRoles: ["student", "instructor", "admin"],
    rolloutPhase: "general_availability",
    loggingSensitivity: "standard",
    statusNote:
      "Used for relational algebra tutoring and SQL-to-RA mapping. Kept out of voice mode to avoid noisy low-latency responses.",
  },
  {
    schema: gradeWithRubricTool,
    lifecycle: "production",
    enabledContexts: ["admin"],
    allowedRoles: ["instructor", "admin"],
    rolloutPhase: "admin_only",
    loggingSensitivity: "restricted",
    featureFlag: "FF_SKILL_RUBRIC_GRADER",
    statusNote:
      "Structured rubric grading for assignment review workflows with confidence-based escalation.",
  },
  {
    schema: listInstructorMcpCapabilitiesTool,
    lifecycle: "production",
    enabledContexts: ["admin"],
    allowedRoles: ["admin"],
    rolloutPhase: "internal",
    loggingSensitivity: "restricted",
    featureFlag: "FEATURE_OPENAI_CONNECTORS",
    statusNote:
      "Exploration manifest for future remote MCP integrations across instructor-facing workflows.",
  },
  {
    schema: codeInterpreterTool,
    lifecycle: "production",
    enabledContexts: ["admin"],
    allowedRoles: ["admin"],
    rolloutPhase: "admin_only",
    loggingSensitivity: "restricted",
    statusNote:
      "Admin-only built-in analysis tool. Never expose by default in student chat.",
  },
  {
    schema: webSearchTool,
    lifecycle: "production",
    enabledContexts: ["admin"],
    allowedRoles: ["admin"],
    rolloutPhase: "admin_only",
    loggingSensitivity: "sensitive",
    featureFlag: "FEATURE_OPENAI_WEB_SEARCH",
    statusNote:
      "Hosted web search for current external facts and documentation lookups. Keep disabled outside admin workflows.",
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

export function isToolRuntimeEnabled(entry: ToolCatalogEntry): boolean {
  return entry.featureFlag ? getOpenAIFeatureFlag(entry.featureFlag) : true;
}

export function getToolRuntimeDiagnostics(entry: ToolCatalogEntry) {
  return {
    runtimeEnabled: isToolRuntimeEnabled(entry),
    featureFlag: entry.featureFlag || null,
    featureFlagEnabled: entry.featureFlag ? getOpenAIFeatureFlag(entry.featureFlag) : true,
  };
}

export function getOpenAIToolFeatureFlagDiagnostics() {
  return getOpenAIFeatureFlags();
}

export function getToolRolloutMatrix() {
  return (["main_chat", "homework_runner", "admin", "voice"] as MichaelToolContext[]).map(
    (context) => ({
      context,
      boundary: TOOL_CONTEXT_BOUNDARIES[context],
      tools: getToolCatalog({
        context,
        includeExperimental: true,
        includeDisabled: true,
      }).map((entry) => ({
        name: getToolName(entry.schema),
        lifecycle: entry.lifecycle,
        rolloutPhase: entry.rolloutPhase,
        allowedRoles: entry.allowedRoles,
        loggingSensitivity: entry.loggingSensitivity,
        ...getToolRuntimeDiagnostics(entry),
      })),
    })
  );
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
  return getToolCatalog(options)
    .filter((entry) => isToolRuntimeEnabled(entry))
    .map((entry) => normalizeToolSchema(entry.schema));
}

export const SHARED_TOOL_SCHEMAS: MichaelToolDefinition[] = getToolSchemas();


export type ToolSelectionReason = {
  toolName: string;
  reason: string;
};

export function selectToolsForRequest(params: {
  context: MichaelToolContext;
  role: MichaelToolRole;
  query: string;
}): { tools: MichaelToolDefinition[]; reasons: ToolSelectionReason[] } {
  const normalizedQuery = (params.query || "").toLowerCase();
  const catalog = getToolCatalog({ context: params.context }).filter(
    (entry) => entry.allowedRoles.includes(params.role) && isToolRuntimeEnabled(entry)
  );

  const selected = catalog.filter((entry) => {
    const name = getToolName(entry.schema);
    if (!getOpenAIFeatureFlag("FF_TOOL_SEARCH_MCP")) {
      return true;
    }

    if (params.context !== "admin") {
      return !["list_instructor_mcp_capabilities", "code_interpreter", "web_search", "grade_with_rubric"].includes(name);
    }

    if (name === "grade_with_rubric") {
      return /rubric|grade|grading|assessment|score|evaluate/.test(normalizedQuery);
    }
    if (name === "list_instructor_mcp_capabilities") {
      return /mcp|connector|drive|gmail|calendar|gradebook|lms|registry/.test(normalizedQuery);
    }
    if (name === "web_search") {
      return /latest|today|current|official docs|documentation|news/.test(normalizedQuery);
    }
    return true;
  });

  return {
    tools: selected.map((entry) => normalizeToolSchema(entry.schema)),
    reasons: selected.map((entry) => ({
      toolName: getToolName(entry.schema),
      reason:
        params.context === "admin"
          ? "Selected by dynamic admin tool routing from semantic query match and role allowlist."
          : "Selected by context allowlist for tutoring route.",
    })),
  };
}

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

type RelationalAlgebraStepResult = {
  title: string;
  operator: string;
  symbol: string;
  expression: string;
  explanation: string;
  sqlEquivalent?: string;
};

type RelationalAlgebraExampleResult = {
  concept: string;
  sqlExample: string;
  relationalAlgebraExample: string;
  note: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function detectRelationalAlgebraInputLanguage(
  expression: string,
  explicitSourceLanguage?: string
): "sql" | "relational_algebra" {
  if (explicitSourceLanguage === "sql" || explicitSourceLanguage === "relational_algebra") {
    return explicitSourceLanguage;
  }

  if (/[πσρ⋈γ∪∩÷×−]/u.test(expression)) {
    return "relational_algebra";
  }

  return /\bSELECT\b|\bFROM\b|\bWHERE\b|\bJOIN\b|\bGROUP\s+BY\b|\bHAVING\b/i.test(expression)
    ? "sql"
    : "relational_algebra";
}

function extractClause(query: string, pattern: RegExp): string | null {
  const match = pattern.exec(query);
  return match?.[1] ? normalizeWhitespace(match[1]) : null;
}

function splitCommaSeparated(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function buildRelationalAlgebraExamples(
  targetLanguage: "he" | "en",
  concepts: Array<"projection" | "selection" | "join" | "grouping" | "nested">
): RelationalAlgebraExampleResult[] {
  const uniqueConcepts = Array.from(new Set(concepts));

  return uniqueConcepts.map((concept) => {
    if (concept === "projection") {
      return targetLanguage === "he"
        ? {
            concept: "הקרנה",
            sqlExample: "SELECT student_name FROM Students",
            relationalAlgebraExample: "π student_name (Students)",
            note: "הקרנה בוחרת רק את העמודות הדרושות בלי לשנות את מספר השורות.",
          }
        : {
            concept: "Projection",
            sqlExample: "SELECT student_name FROM Students",
            relationalAlgebraExample: "π student_name (Students)",
            note: "Projection keeps only the required columns.",
          };
    }

    if (concept === "selection") {
      return targetLanguage === "he"
        ? {
            concept: "בחירה",
            sqlExample: "SELECT * FROM Students WHERE grade > 90",
            relationalAlgebraExample: "σ grade > 90 (Students)",
            note: "בחירה מסננת שורות לפי תנאי.",
          }
        : {
            concept: "Selection",
            sqlExample: "SELECT * FROM Students WHERE grade > 90",
            relationalAlgebraExample: "σ grade > 90 (Students)",
            note: "Selection filters rows by a predicate.",
          };
    }

    if (concept === "join") {
      return targetLanguage === "he"
        ? {
            concept: "צירוף",
            sqlExample:
              "SELECT * FROM Students JOIN Enrollments ON Students.id = Enrollments.student_id",
            relationalAlgebraExample:
              "Students ⋈ Students.id = Enrollments.student_id Enrollments",
            note: "צירוף מחבר שתי טבלאות לפי תנאי התאמה.",
          }
        : {
            concept: "Join",
            sqlExample:
              "SELECT * FROM Students JOIN Enrollments ON Students.id = Enrollments.student_id",
            relationalAlgebraExample:
              "Students ⋈ Students.id = Enrollments.student_id Enrollments",
            note: "Join combines relations using a matching condition.",
          };
    }

    if (concept === "grouping") {
      return targetLanguage === "he"
        ? {
            concept: "קיבוץ והצטברות",
            sqlExample:
              "SELECT department_id, COUNT(*) FROM Students GROUP BY department_id",
            relationalAlgebraExample: "γ department_id; COUNT(*)→student_count (Students)",
            note: "באלגברה מורחבת משתמשים ב-γ כדי לייצג GROUP BY ופעולות הצטברות.",
          }
        : {
            concept: "Grouping",
            sqlExample:
              "SELECT department_id, COUNT(*) FROM Students GROUP BY department_id",
            relationalAlgebraExample: "γ department_id; COUNT(*)→student_count (Students)",
            note: "Extended relational algebra uses γ for grouping and aggregation.",
          };
    }

    return targetLanguage === "he"
      ? {
          concept: "לוגיקה מקוננת",
          sqlExample:
            "SELECT name FROM Students WHERE id IN (SELECT student_id FROM Honors)",
          relationalAlgebraExample:
            "π name (Students ⋉ Students.id = Honors.student_id Honors)",
          note: "תת-שאילתה מסוג IN או EXISTS ניתנת לעיתים להסבר באמצעות semijoin או באמצעות פעולות קבוצה.",
        }
      : {
          concept: "Nested logic",
          sqlExample:
            "SELECT name FROM Students WHERE id IN (SELECT student_id FROM Honors)",
          relationalAlgebraExample:
            "π name (Students ⋉ Students.id = Honors.student_id Honors)",
          note: "IN or EXISTS subqueries can often be explained as a semijoin or set-based filter.",
        };
  });
}

function buildSqlToRelationalAlgebraExplanation(
  query: string,
  targetLanguage: "he" | "en",
  includeExamples: boolean
) {
  const normalized = normalizeSql(query);
  const selectClause = extractClause(normalized, /\bSELECT\s+(.+?)\s+\bFROM\b/is);
  const fromClause = extractClause(
    normalized,
    /\bFROM\s+(.+?)(?=\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|$)/is
  );
  const whereClause = extractClause(
    normalized,
    /\bWHERE\s+(.+?)(?=\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|$)/is
  );
  const groupByClause = extractClause(
    normalized,
    /\bGROUP\s+BY\s+(.+?)(?=\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|$)/is
  );
  const havingClause = extractClause(
    normalized,
    /\bHAVING\s+(.+?)(?=\bORDER\s+BY\b|\bLIMIT\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|$)/is
  );
  const orderByClause = extractClause(
    normalized,
    /\bORDER\s+BY\s+(.+?)(?=\bLIMIT\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|$)/is
  );
  const limitClause = extractClause(normalized, /\bLIMIT\s+(.+?)$/is);
  const joinMatches = Array.from(
    normalized.matchAll(
      /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+([a-zA-Z0-9_.]+)(?:\s+\w+)?(?:\s+ON\s+(.+?))?(?=\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b|\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|\bLIMIT\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|$)/gis
    )
  ).map((match) => ({
    table: normalizeWhitespace(match[1] || ""),
    condition: normalizeWhitespace(match[2] || ""),
  }));

  const baseRelation = joinMatches.length > 0
    ? joinMatches.reduce((current, join) => {
        const joinSuffix = join.condition ? ` ⋈_${join.condition} ${join.table}` : ` × ${join.table}`;
        return `(${current}${joinSuffix})`;
      }, normalizeWhitespace(fromClause?.split(/\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i)[0] || fromClause || "Relation"))
    : normalizeWhitespace(fromClause || "Relation");

  let relationalAlgebraExpression = baseRelation;
  const steps: RelationalAlgebraStepResult[] = [];
  const concepts: Array<"projection" | "selection" | "join" | "grouping" | "nested"> = [];

  if (joinMatches.length > 0) {
    concepts.push("join");
    joinMatches.forEach((join, index) => {
      steps.push(
        targetLanguage === "he"
          ? {
              title: `שלב ${index + 1}: צירוף`,
              operator: "join",
              symbol: "⋈",
              expression: join.condition
                ? `${index === 0 ? baseRelation : join.table} ⋈_${join.condition}`
                : `${index === 0 ? baseRelation : join.table} × ${join.table}`,
              explanation: join.condition
                ? `מחברים את ${join.table} לפי תנאי ההתאמה ${join.condition}.`
                : `אין תנאי צירוף מפורש, ולכן מתקבל מכפלה קרטזית עם ${join.table}.`,
              sqlEquivalent: join.condition
                ? `JOIN ${join.table} ON ${join.condition}`
                : `CROSS JOIN ${join.table}`,
            }
          : {
              title: `Step ${index + 1}: Join`,
              operator: "join",
              symbol: "⋈",
              expression: join.condition
                ? `${index === 0 ? baseRelation : join.table} ⋈_${join.condition}`
                : `${index === 0 ? baseRelation : join.table} × ${join.table}`,
              explanation: join.condition
                ? `Join ${join.table} using the predicate ${join.condition}.`
                : `Without an ON predicate this behaves like a Cartesian product with ${join.table}.`,
              sqlEquivalent: join.condition
                ? `JOIN ${join.table} ON ${join.condition}`
                : `CROSS JOIN ${join.table}`,
            }
      );
    });
  }

  if (whereClause) {
    concepts.push("selection");
    relationalAlgebraExpression = `σ_${whereClause} (${relationalAlgebraExpression})`;
    steps.push(
      targetLanguage === "he"
        ? {
            title: "סינון התוצאה",
            operator: "selection",
            symbol: "σ",
            expression: `σ_${whereClause} (${baseRelation})`,
            explanation: `מפעילים בחירה כדי להשאיר רק שורות שמקיימות את התנאי ${whereClause}.`,
            sqlEquivalent: `WHERE ${whereClause}`,
          }
        : {
            title: "Filter rows",
            operator: "selection",
            symbol: "σ",
            expression: `σ_${whereClause} (${baseRelation})`,
            explanation: `Apply a selection so only rows satisfying ${whereClause} remain.`,
            sqlEquivalent: `WHERE ${whereClause}`,
          }
    );
  }

  if (groupByClause) {
    concepts.push("grouping");
    const aggregates = splitCommaSeparated(selectClause).filter((item) =>
      /(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(item)
    );
    const gammaParts = [groupByClause, ...aggregates].filter(Boolean).join("; ");
    relationalAlgebraExpression = `γ_${gammaParts} (${relationalAlgebraExpression})`;
    steps.push(
      targetLanguage === "he"
        ? {
            title: "קיבוץ והצטברות",
            operator: "grouping",
            symbol: "γ",
            expression: `γ_${gammaParts} (${whereClause ? `σ_${whereClause} (${baseRelation})` : baseRelation})`,
            explanation:
              "כאן משתמשים באלגברה מורחבת: γ מייצגת GROUP BY ולעיתים גם פונקציות הצטברות כמו COUNT או SUM.",
            sqlEquivalent: `GROUP BY ${groupByClause}${havingClause ? ` HAVING ${havingClause}` : ""}`,
          }
        : {
            title: "Group and aggregate",
            operator: "grouping",
            symbol: "γ",
            expression: `γ_${gammaParts} (${whereClause ? `σ_${whereClause} (${baseRelation})` : baseRelation})`,
            explanation:
              "Extended relational algebra uses γ to represent GROUP BY and aggregate functions.",
            sqlEquivalent: `GROUP BY ${groupByClause}${havingClause ? ` HAVING ${havingClause}` : ""}`,
          }
    );
  }

  if (havingClause) {
    concepts.push("selection");
    relationalAlgebraExpression = `σ_${havingClause} (${relationalAlgebraExpression})`;
    steps.push(
      targetLanguage === "he"
        ? {
            title: "סינון אחרי הקיבוץ",
            operator: "selection",
            symbol: "σ",
            expression: `σ_${havingClause} (${relationalAlgebraExpression.replace(`σ_${havingClause} `, "")})`,
            explanation: "אחרי הקיבוץ אפשר לסנן קבוצות בעזרת תנאי HAVING.",
            sqlEquivalent: `HAVING ${havingClause}`,
          }
        : {
            title: "Filter grouped rows",
            operator: "selection",
            symbol: "σ",
            expression: `σ_${havingClause} (${relationalAlgebraExpression.replace(`σ_${havingClause} `, "")})`,
            explanation: "After grouping, HAVING becomes another selection over grouped results.",
            sqlEquivalent: `HAVING ${havingClause}`,
          }
    );
  }

  if (selectClause) {
    concepts.push("projection");
    relationalAlgebraExpression = `π_${selectClause} (${relationalAlgebraExpression})`;
    steps.push(
      targetLanguage === "he"
        ? {
            title: "הקרנת העמודות המבוקשות",
            operator: "projection",
            symbol: "π",
            expression: relationalAlgebraExpression,
            explanation: `בסוף בוחרים רק את העמודות ${selectClause}.`,
            sqlEquivalent: `SELECT ${selectClause}`,
          }
        : {
            title: "Project the requested columns",
            operator: "projection",
            symbol: "π",
            expression: relationalAlgebraExpression,
            explanation: `Finally project only the requested columns: ${selectClause}.`,
            sqlEquivalent: `SELECT ${selectClause}`,
          }
    );
  }

  const hasNestedLogic = /\b(EXISTS|NOT EXISTS|IN\s*\(|NOT IN\s*\(|ALL\s*\(|ANY\s*\()/i.test(normalized);
  if (hasNestedLogic) {
    concepts.push("nested");
    steps.push(
      targetLanguage === "he"
        ? {
            title: "לוגיקה מקוננת",
            operator: "nested_logic",
            symbol: "⋉ / −",
            expression: relationalAlgebraExpression,
            explanation:
              "לתת-שאילתות מסוג EXISTS, IN או NOT EXISTS אין תמיד סימון יחיד. לרוב מסבירים אותן באמצעות semijoin, anti-join או פעולות קבוצה.",
            sqlEquivalent: "EXISTS / IN / NOT EXISTS",
          }
        : {
            title: "Nested logic",
            operator: "nested_logic",
            symbol: "⋉ / −",
            expression: relationalAlgebraExpression,
            explanation:
              "EXISTS, IN, and NOT EXISTS are often explained via semijoins, anti-joins, or set operations.",
            sqlEquivalent: "EXISTS / IN / NOT EXISTS",
          }
    );
  }

  const scopeNotes = [
    orderByClause
      ? targetLanguage === "he"
        ? "ORDER BY שייך למיון תצוגה ולא לאלגברת יחסים הקלאסית, לכן מסבירים אותו במלל ולא כסימון RA."
        : "ORDER BY affects presentation order and does not belong to classical relational algebra."
      : null,
    limitClause
      ? targetLanguage === "he"
        ? "LIMIT/TOP הם מנגנוני הגבלה של SQL ואינם חלק מאלגברת יחסים קלאסית."
        : "LIMIT/TOP is SQL-specific and not part of classical relational algebra."
      : null,
  ].filter(Boolean);

  const summary = targetLanguage === "he"
    ? "מתרגמים את השאילתה מרמת SQL לרצף של פעולות אלגברת יחסים: צירוף, סינון, קיבוץ והקרנה."
    : "Translate the SQL query into a relational algebra pipeline of joins, selections, grouping, and projection.";

  return {
    summary,
    relationalAlgebraExpression,
    steps,
    commonMistakes:
      targetLanguage === "he"
        ? [
            "לבלבל בין σ שמסננת שורות לבין π שבוחרת עמודות.",
            "לשכוח שתנאי הצירוף שייך ל-⋈ ולא ל-π.",
            ...(groupByClause ? ["לשכוח ש-GROUP BY מיוצג ב-γ ולא ב-π."] : []),
          ]
        : [
            "Mixing up σ for row filtering with π for column projection.",
            "Forgetting that join predicates belong to ⋈ rather than π.",
            ...(groupByClause ? ["GROUP BY maps to γ, not to projection."] : []),
          ],
    examples: includeExamples ? buildRelationalAlgebraExamples(targetLanguage, concepts) : [],
    scopeNote:
      scopeNotes.join(" ") ||
      (targetLanguage === "he"
        ? "הביטוי נשאר בתוך אלגברת יחסים קלאסית או מורחבת לפי הצורך."
        : "The explanation stays within classical or extended relational algebra as needed."),
  };
}

function buildRelationalAlgebraExpressionExplanation(
  expression: string,
  targetLanguage: "he" | "en",
  includeExamples: boolean
) {
  const normalized = normalizeWhitespace(expression);
  const operatorDefinitions = [
    {
      key: "selection",
      symbol: "σ",
      operator: "selection",
      title: targetLanguage === "he" ? "בחירה" : "Selection",
      explanation:
        targetLanguage === "he"
          ? "σ מסננת שורות לפי תנאי."
          : "σ filters rows with a predicate.",
      sqlEquivalent: "WHERE ...",
    },
    {
      key: "projection",
      symbol: "π",
      operator: "projection",
      title: targetLanguage === "he" ? "הקרנה" : "Projection",
      explanation:
        targetLanguage === "he"
          ? "π שומרת רק את העמודות הדרושות."
          : "π keeps only the required columns.",
      sqlEquivalent: "SELECT column_list",
    },
    {
      key: "join",
      symbol: "⋈",
      operator: "join",
      title: targetLanguage === "he" ? "צירוף" : "Join",
      explanation:
        targetLanguage === "he"
          ? "⋈ מחבר שתי טבלאות לפי תנאי התאמה."
          : "⋈ combines two relations using a match condition.",
      sqlEquivalent: "JOIN ... ON ...",
    },
    {
      key: "rename",
      symbol: "ρ",
      operator: "rename",
      title: targetLanguage === "he" ? "שינוי שם" : "Rename",
      explanation:
        targetLanguage === "he"
          ? "ρ מחליף שם לטבלה או לעמודות כדי למנוע בלבול."
          : "ρ renames a relation or attributes.",
      sqlEquivalent: "table aliases / column aliases",
    },
    {
      key: "grouping",
      symbol: "γ",
      operator: "grouping",
      title: targetLanguage === "he" ? "קיבוץ" : "Grouping",
      explanation:
        targetLanguage === "he"
          ? "γ מייצגת GROUP BY והצטברויות באלגברה מורחבת."
          : "γ represents grouping and aggregation in extended relational algebra.",
      sqlEquivalent: "GROUP BY",
    },
  ] as const;

  const matchedDefinitions = operatorDefinitions.filter((definition) =>
    normalized.includes(definition.symbol)
  );
  const concepts = matchedDefinitions.map((definition) => definition.key) as Array<
    "projection" | "selection" | "join" | "grouping"
  >;

  return {
    summary:
      targetLanguage === "he"
        ? "מפרקים את ביטוי אלגברת היחסים לאופרטורים המרכזיים שמופיעים בו."
        : "Break the relational algebra expression into the operators it uses.",
    relationalAlgebraExpression: normalized,
    steps: matchedDefinitions.map((definition, index) => ({
      title:
        targetLanguage === "he"
          ? `שלב ${index + 1}: ${definition.title}`
          : `Step ${index + 1}: ${definition.title}`,
      operator: definition.operator,
      symbol: definition.symbol,
      expression: normalized,
      explanation: definition.explanation,
      sqlEquivalent: definition.sqlEquivalent,
    })),
    commonMistakes:
      targetLanguage === "he"
        ? [
            "לקרוא את הביטוי משמאל לימין בלבד במקום לזהות קודם את הפעולה הפנימית.",
            "לשכוח ש-ρ חשוב כאשר אותה טבלה מופיעה יותר מפעם אחת.",
          ]
        : [
            "Reading only left-to-right instead of identifying the inner operation first.",
            "Forgetting that ρ matters when the same relation appears more than once.",
          ],
    examples: includeExamples ? buildRelationalAlgebraExamples(targetLanguage, concepts) : [],
    scopeNote:
      targetLanguage === "he"
        ? "אם יש בביטוי גם γ, מדובר באלגברה מורחבת ולא רק קלאסית."
        : "If the expression uses γ, it is using extended rather than purely classical relational algebra.",
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

function getScopedStudentId(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): string | null {
  const contextualStudentId =
    context.studentId?.trim() || context.userEmail?.trim() || context.userId?.trim() || null;

  if (context.toolContext === "main_chat" || context.toolContext === "homework_runner") {
    return contextualStudentId;
  }

  if (context.userRole === "student") {
    return contextualStudentId;
  }

  const explicit = typeof args.student_id === "string" ? args.student_id.trim() : "";
  return explicit || contextualStudentId;
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
    const studentId = getScopedStudentId(args, context);
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

  async get_student_progress_snapshot(args, context) {
    const studentId = getScopedStudentId(args, context);
    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    return {
      success: true,
      ...(await getStudentProgressSnapshot({
        studentId,
        homeworkSetId: getResolvedHomeworkSetId(args, context),
      })),
    };
  },

  async get_recent_submission_attempts(args, context) {
    const studentId = getScopedStudentId(args, context);
    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    return {
      success: true,
      ...(await getRecentSubmissionAttempts({
        studentId,
        homeworkSetId: getResolvedHomeworkSetId(args, context),
      })),
    };
  },

  async get_deadline_and_schedule_context(args, context) {
    const studentId = getScopedStudentId(args, context);
    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    return {
      success: true,
      ...(await getDeadlineAndScheduleContext({
        studentId,
        homeworkSetId: getResolvedHomeworkSetId(args, context),
      })),
    };
  },

  async recommend_next_learning_step(args, context) {
    const studentId = getScopedStudentId(args, context);
    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    return {
      success: true,
      ...(await recommendNextLearningStep({
        studentId,
        homeworkSetId: getResolvedHomeworkSetId(args, context),
        questionId:
          typeof args.question_id === "string"
            ? args.question_id.trim()
            : context.questionId?.trim() || null,
      })),
    };
  },

  async generate_personalized_quiz_from_mistakes(args, context) {
    const studentId = getScopedStudentId(args, context);
    if (!studentId) {
      return {
        success: false,
        error: "student_id is required unless the tutoring request is already tied to an authenticated student.",
      };
    }

    const quiz = await generatePersonalizedQuizFromMistakes({
      studentId,
      homeworkSetId: getResolvedHomeworkSetId(args, context),
      questionId:
        typeof args.question_id === "string"
          ? args.question_id.trim()
          : context.questionId?.trim() || null,
      maxQuestions: Number(args.max_questions || 4),
    });

    return {
      success: true,
      quiz: {
        quizId: quiz.quizId,
        targetType: quiz.targetType,
        targetId: quiz.targetId,
        title: quiz.title,
        createdAt: quiz.createdAt,
        personalization: quiz.personalization || null,
        questionCount: quiz.questions.length,
      },
    };
  },

  async remember_student_preference(args, context) {
    const studentId = getScopedStudentId(args, context);
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

  async explain_relational_algebra_step(args) {
    const inputExpression = String(args.input_expression ?? "").trim();
    const explicitSourceLanguage = String(args.source_language ?? "auto").trim();
    const targetLanguage =
      String(args.target_language ?? "he").trim() === "en" ? "en" : "he";
    const includeExamples = args.include_examples !== false;

    if (!inputExpression) {
      return {
        success: false,
        error: "input_expression is required.",
      };
    }

    const sourceLanguage = detectRelationalAlgebraInputLanguage(
      inputExpression,
      explicitSourceLanguage
    );

    const explanation =
      sourceLanguage === "sql"
        ? buildSqlToRelationalAlgebraExplanation(
            inputExpression,
            targetLanguage,
            includeExamples
          )
        : buildRelationalAlgebraExpressionExplanation(
            inputExpression,
            targetLanguage,
            includeExamples
          );

    return {
      success: true,
      sourceLanguage,
      targetLanguage,
      ...explanation,
    };
  },

  async grade_with_rubric(args) {
    return gradeWithRubric({
      rubric: Array.isArray(args.rubric) ? (args.rubric as any[]) : [],
      studentResponse: String(args.student_response ?? ""),
      assignmentContext: typeof args.assignment_context === "string" ? args.assignment_context : undefined,
    });
  },

  async list_instructor_mcp_capabilities() {
    return listInstructorConnectorCapabilities();
  },
};

export async function executeToolCall(
  request: ToolCallRequest,
  context: ToolExecutionContext = {}
): Promise<string> {
  const handler = toolHandlers[request.name];
  const role = context.userRole || "student";
  const toolContext = context.toolContext || "main_chat";
  const catalogEntry = getToolCatalog({ context: toolContext, includeExperimental: true, includeDisabled: true }).find(
    (entry) => getToolName(entry.schema) === request.name
  );

  if (catalogEntry && !catalogEntry.allowedRoles.includes(role)) {
    return JSON.stringify({ success: false, error: `Tool ${request.name} is not allowed for role ${role}.` });
  }

  if (catalogEntry && !isToolRuntimeEnabled(catalogEntry)) {
    return JSON.stringify({ success: false, error: `Tool ${request.name} is disabled by feature flag.` });
  }
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
