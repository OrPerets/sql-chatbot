/**
 * @jest-environment node
 */

const mockCreateResponse = jest.fn();
const mockGetOrCreateVectorStoreId = jest.fn();

jest.mock("@/lib/openai/api-mode", () => ({
  getOpenAIApiMode: () => "responses",
  isResponsesMode: () => true,
}));

jest.mock("@/lib/openai/responses-client", () => ({
  createResponse: (...args: any[]) => mockCreateResponse(...args),
  streamResponse: jest.fn(),
  extractOutputText: (response: any) => response?.output_text || "",
}));

jest.mock("@/lib/openai/vector-store", () => ({
  getOrCreateAppVectorStoreId: (...args: any[]) => mockGetOrCreateVectorStoreId(...args),
  buildFileSearchTool: (vectorStoreId: string) => ({ type: "file_search", vector_store_ids: [vectorStoreId] }),
}));

jest.mock("@/app/agent-config", () => ({
  getAgentTools: () => [{ type: "function", name: "get_course_week_context", parameters: { type: "object" } }],
}));

jest.mock("@/lib/openai/tools", () => ({
  executeToolCall: jest.fn(),
}));

jest.mock("@/app/openai", () => ({
  openai: {
    files: {
      create: jest.fn(),
    },
  },
}));

describe("Responses API routes", () => {
  beforeEach(() => {
    mockCreateResponse.mockReset();
    mockGetOrCreateVectorStoreId.mockReset();
  });

  it("creates a responses session", async () => {
    const { POST } = await import("../../app/api/responses/sessions/route");
    const request = new Request("http://localhost:3000/api/responses/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { source: "test" } }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("responses");
    expect(payload.sessionId).toMatch(/^sess_/);
    expect(payload.responseId).toBeNull();
    expect(payload.compatibility).toBe("responses_session");
  });

  it("returns validation error when no content or image is provided", async () => {
    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "sess_1", stream: false }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Either content or imageData is required");
  });

  it("returns non-stream response payload from responses loop", async () => {
    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_final_1",
      output_text: "שלום! איך אפשר לעזור?",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_test_1",
        previousResponseId: "resp_prev_1",
        content: "היי",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("responses");
    expect(payload.sessionId).toBe("sess_test_1");
    expect(payload.responseId).toBe("resp_final_1");
    expect(payload.outputText).toBe("שלום! איך אפשר לעזור?");
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
    expect(mockCreateResponse.mock.calls[0][0].toolChoice).toEqual({
      type: "function",
      name: "get_course_week_context",
    });
    expect(mockCreateResponse.mock.calls[0][0].input[0].content[0].text).toBe("היי");
  });
});
