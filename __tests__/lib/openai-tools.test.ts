import { getToolCatalog, getToolName, getToolSchemas } from "@/lib/openai/tools";

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
      "remember_student_preference",
      "generate_next_practice_step",
      "analyze_query_performance",
      "render_sql_visualization",
    ]);
  });

  it("keeps admin-only tools out of the main chat context", () => {
    const toolNames = getToolSchemas({ context: "main_chat" }).map((tool) => getToolName(tool));

    expect(toolNames).not.toContain("code_interpreter");
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
});
