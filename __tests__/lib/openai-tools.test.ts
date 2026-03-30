import { getToolCatalog, getToolSchemas } from "@/lib/openai/tools";

describe("openai tool catalog", () => {
  it("only exposes production tools by default", () => {
    const toolNames = getToolSchemas().map((tool) => tool.name);
    expect(toolNames).toEqual(["get_course_week_context", "get_database_schema"]);
  });

  it("keeps experimental and disabled tools out of the default catalog", () => {
    const catalog = getToolCatalog({ context: "main_chat" });
    expect(catalog.every((entry) => entry.lifecycle === "production")).toBe(true);
  });

  it("includes experimental and disabled entries when explicitly requested", () => {
    const catalog = getToolCatalog({
      includeExperimental: true,
      includeDisabled: true,
    });
    expect(catalog.some((entry) => entry.schema.name === "execute_sql_query" && entry.lifecycle === "experimental")).toBe(true);
    expect(catalog.some((entry) => entry.schema.name === "get_weather" && entry.lifecycle === "disabled")).toBe(true);
  });
});
