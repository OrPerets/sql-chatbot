const mockGetStudentProgressSnapshot = jest.fn();
const mockGetRecentSubmissionAttempts = jest.fn();
const mockGetDeadlineAndScheduleContext = jest.fn();
const mockRecommendNextLearningStep = jest.fn();
const mockGeneratePersonalizedQuizFromMistakes = jest.fn();

jest.mock("@/lib/personalization", () => ({
  getStudentProgressSnapshot: (...args: unknown[]) => mockGetStudentProgressSnapshot(...args),
  getRecentSubmissionAttempts: (...args: unknown[]) => mockGetRecentSubmissionAttempts(...args),
  getDeadlineAndScheduleContext: (...args: unknown[]) => mockGetDeadlineAndScheduleContext(...args),
  recommendNextLearningStep: (...args: unknown[]) => mockRecommendNextLearningStep(...args),
  generatePersonalizedQuizFromMistakes: (...args: unknown[]) =>
    mockGeneratePersonalizedQuizFromMistakes(...args),
}));

import {
  executeToolCall,
  getToolCatalog,
  getToolName,
  getToolSchemas,
} from "@/lib/openai/tools";

function assertStrictObjectNodesClosed(schema: Record<string, any>) {
  const type = schema?.type;
  const isObjectNode =
    type === "object" ||
    (Array.isArray(type) && type.includes("object")) ||
    (schema?.properties && typeof schema.properties === "object");

  if (isObjectNode) {
    const properties = schema.properties || {};
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(Object.keys(properties));
  }

  if (schema?.properties && typeof schema.properties === "object") {
    for (const value of Object.values(schema.properties)) {
      if (value && typeof value === "object") {
        assertStrictObjectNodesClosed(value as Record<string, any>);
      }
    }
  }

  if (schema?.items && typeof schema.items === "object") {
    assertStrictObjectNodesClosed(schema.items as Record<string, any>);
  }

  if (Array.isArray(schema?.anyOf)) {
    for (const value of schema.anyOf) {
      if (value && typeof value === "object") {
        assertStrictObjectNodesClosed(value as Record<string, any>);
      }
    }
  }
}

describe("openai tool catalog", () => {
  it("exposes the expanded production toolset for main chat", () => {
    const toolNames = getToolSchemas({ context: "main_chat" }).map((tool) => getToolName(tool));

    expect(toolNames).toEqual([
      "get_course_week_context",
      "get_database_schema",
      "execute_sql_query",
      "validate_sql_answer",
      "compare_sql_queries",
      "get_homework_context",
      "get_student_learning_profile",
      "get_student_progress_snapshot",
      "get_recent_submission_attempts",
      "get_deadline_and_schedule_context",
      "recommend_next_learning_step",
      "generate_personalized_quiz_from_mistakes",
      "remember_student_preference",
      "generate_next_practice_step",
      "analyze_query_performance",
      "render_sql_visualization",
      "explain_relational_algebra_step",
    ]);
  });

  it("keeps admin-only tools out of the main chat context", () => {
    const toolNames = getToolSchemas({ context: "main_chat" }).map((tool) => getToolName(tool));

    expect(toolNames).not.toContain("code_interpreter");
  });

  it("keeps personalization tools out of the homework runner context", () => {
    const toolNames = getToolSchemas({ context: "homework_runner" }).map((tool) => getToolName(tool));

    expect(toolNames).not.toContain("get_student_learning_profile");
    expect(toolNames).not.toContain("get_student_progress_snapshot");
    expect(toolNames).not.toContain("get_recent_submission_attempts");
    expect(toolNames).not.toContain("get_deadline_and_schedule_context");
    expect(toolNames).not.toContain("recommend_next_learning_step");
    expect(toolNames).not.toContain("generate_personalized_quiz_from_mistakes");
    expect(toolNames).not.toContain("remember_student_preference");
    expect(toolNames).not.toContain("generate_next_practice_step");
  });

  it("includes code interpreter for admin context only", () => {
    const adminToolNames = getToolSchemas({ context: "admin" }).map((tool) => getToolName(tool));
    const mainToolNames = getToolSchemas({ context: "main_chat" }).map((tool) => getToolName(tool));

    expect(adminToolNames).toContain("code_interpreter");
    expect(mainToolNames).not.toContain("code_interpreter");
  });

  it("marks every current tool as production lifecycle", () => {
    const catalog = getToolCatalog({
      context: "main_chat",
      includeExperimental: true,
      includeDisabled: true,
    });

    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.every((entry) => entry.lifecycle === "production")).toBe(true);
  });

  it("normalizes strict function schemas for Responses API compatibility", () => {
    const tools = [
      ...getToolSchemas({ context: "main_chat" }),
      ...getToolSchemas({ context: "admin" }),
    ];

    for (const tool of tools) {
      if (tool.type !== "function" || !tool.strict) {
        continue;
      }

      const parameters = tool.parameters as Record<string, unknown>;
      const properties = (parameters.properties || {}) as Record<string, unknown>;
      const required = Array.isArray(parameters.required) ? parameters.required : [];

      expect(required).toEqual(Object.keys(properties));
      assertStrictObjectNodesClosed(parameters as Record<string, any>);
    }
  });

  it("keeps optional strict fields nullable after normalization", () => {
    const courseWeekContextTool = getToolSchemas({ context: "main_chat" }).find(
      (tool) => tool.type === "function" && tool.name === "get_course_week_context"
    );

    expect(courseWeekContextTool).toBeDefined();

    const parameters = (courseWeekContextTool as { parameters: Record<string, any> }).parameters;
    expect(parameters.required).toEqual(["week"]);
    expect(parameters.properties.week.type).toEqual(["number", "null"]);
  });

  it("closes nested strict object schemas", () => {
    const analyzeTool = getToolSchemas({ context: "main_chat" }).find(
      (tool) => tool.type === "function" && tool.name === "analyze_query_performance"
    );
    const renderTool = getToolSchemas({ context: "main_chat" }).find(
      (tool) => tool.type === "function" && tool.name === "render_sql_visualization"
    );

    expect(analyzeTool).toBeDefined();
    expect(renderTool).toBeDefined();

    const analyzeParameters = (analyzeTool as { parameters: Record<string, any> }).parameters;
    expect(analyzeParameters.properties.database_context.additionalProperties).toBe(false);
    expect(analyzeParameters.properties.database_context.properties).toEqual({});
    expect(analyzeParameters.properties.database_context.required).toEqual([]);

    const renderParameters = (renderTool as { parameters: Record<string, any> }).parameters;
    expect(renderParameters.properties.result_preview.items.additionalProperties).toBe(false);
  });

  it("keeps web_search behind an admin-only feature flag", async () => {
    const originalFlag = process.env.FEATURE_OPENAI_WEB_SEARCH;

    try {
      process.env.FEATURE_OPENAI_WEB_SEARCH = "1";
      jest.resetModules();
      const enabledModule = await import("@/lib/openai/tools");
      const enabledAdminTools = enabledModule
        .getToolSchemas({ context: "admin" })
        .map((tool) => enabledModule.getToolName(tool));
      const enabledStudentTools = enabledModule
        .getToolSchemas({ context: "main_chat" })
        .map((tool) => enabledModule.getToolName(tool));

      expect(enabledAdminTools).toContain("web_search");
      expect(enabledStudentTools).not.toContain("web_search");

      process.env.FEATURE_OPENAI_WEB_SEARCH = "0";
      jest.resetModules();
      const disabledModule = await import("@/lib/openai/tools");
      const disabledAdminTools = disabledModule
        .getToolSchemas({ context: "admin" })
        .map((tool) => disabledModule.getToolName(tool));

      expect(disabledAdminTools).not.toContain("web_search");
    } finally {
      if (typeof originalFlag === "undefined") {
        delete process.env.FEATURE_OPENAI_WEB_SEARCH;
      } else {
        process.env.FEATURE_OPENAI_WEB_SEARCH = originalFlag;
      }
      jest.resetModules();
    }
  });

  it("binds personalization tools to the contextual student in homework runner mode", async () => {
    mockGetStudentProgressSnapshot.mockResolvedValue({
      studentId: "student-context",
      generatedAt: "2026-03-31T10:00:00.000Z",
    });

    const result = await executeToolCall(
      {
        callId: "call-1",
        name: "get_student_progress_snapshot",
        argumentsJson: JSON.stringify({
          student_id: "other-student",
          homework_set_id: "hw-5",
        }),
      },
      {
        toolContext: "homework_runner",
        userRole: "student",
        studentId: "student-context",
      }
    );

    expect(mockGetStudentProgressSnapshot).toHaveBeenCalledWith({
      studentId: "student-context",
      homeworkSetId: "hw-5",
    });
    expect(JSON.parse(result)).toEqual({
      success: true,
      studentId: "student-context",
      generatedAt: "2026-03-31T10:00:00.000Z",
    });
  });

  it("returns structured relational algebra guidance for SQL input", async () => {
    const result = await executeToolCall(
      {
        callId: "call-ra-1",
        name: "explain_relational_algebra_step",
        argumentsJson: JSON.stringify({
          input_expression:
            "SELECT student_name FROM Students JOIN Enrollments ON Students.id = Enrollments.student_id WHERE grade > 90",
          source_language: "sql",
          target_language: "he",
        }),
      },
      {
        toolContext: "main_chat",
        userRole: "student",
      }
    );

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.sourceLanguage).toBe("sql");
    expect(parsed.relationalAlgebraExpression).toContain("π_");
    expect(parsed.relationalAlgebraExpression).toContain("σ_");
    expect(parsed.relationalAlgebraExpression).toContain("⋈_");
    expect(parsed.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operator: "join", symbol: "⋈" }),
        expect.objectContaining({ operator: "selection", symbol: "σ" }),
        expect.objectContaining({ operator: "projection", symbol: "π" }),
      ])
    );
    expect(parsed.examples.length).toBeGreaterThan(0);
  });
});
