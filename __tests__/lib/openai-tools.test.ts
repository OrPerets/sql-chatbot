import { getToolCatalog, getToolName, getToolSchemas } from "@/lib/openai/tools";

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
});
