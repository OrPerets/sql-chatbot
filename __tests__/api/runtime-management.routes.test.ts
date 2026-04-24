/**
 * @jest-environment node
 */

jest.mock("@/lib/openai/api-mode", () => ({
  getOpenAIApiMode: () => "responses",
}));

jest.mock("@/app/agent-config", () => ({
  getAgentInstructions: () => "Test instructions",
  getAgentModel: () => "gpt-5.4-mini",
  getAgentTools: () => [{ name: "get_course_week_context" }, { name: "get_database_schema" }],
  getAgentToolCatalog: () => [
    {
      schema: { name: "get_course_week_context", description: "Week context" },
      lifecycle: "production",
      enabledContexts: ["main_chat"],
      allowedRoles: ["student", "admin"],
      rolloutPhase: "general_availability",
      loggingSensitivity: "standard",
      statusNote: null,
    },
  ],
}));

jest.mock("@/lib/openai/runtime-config", () => ({
  getRuntimeAgentConfig: jest.fn(async () => ({
    model: "gpt-5.4-mini",
    instructions: "Test instructions",
    enabledToolNames: ["get_course_week_context"],
    tools: [{ name: "get_course_week_context" }],
    updatedAt: "2026-03-29T00:00:00.000Z",
    source: "default",
    history: [],
  })),
  rollbackRuntimeAgentConfig: jest.fn(),
  updateRuntimeAgentConfig: jest.fn(),
}));

jest.mock("@/lib/openai/responses-client", () => ({
  createResponse: jest.fn(),
  extractOutputText: jest.fn(),
  runToolLoop: jest.fn(),
}));

describe("runtime management routes", () => {
  it("serves canonical runtime config under /api/responses/runtime", async () => {
    const { GET } = await import("@/app/api/responses/runtime/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.compatibility.canonicalRoute).toBe("/api/responses/runtime");
    expect(payload.compatibility.deprecatedAlias).toBe(false);
  });

  it("marks /api/assistants/update as a deprecated alias", async () => {
    const { GET } = await import("@/app/api/assistants/update/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.compatibility.route).toBe("/api/assistants/update");
    expect(payload.compatibility.canonicalRoute).toBe("/api/responses/runtime");
    expect(payload.compatibility.deprecatedAlias).toBe(true);
  });
});
