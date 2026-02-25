/**
 * @jest-environment node
 */

const mockCreateResponse = jest.fn();
const mockGetOrCreateVectorStoreId = jest.fn();
const mockGetCoinsConfig = jest.fn();
const mockChargeMichaelMessage = jest.fn();

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

jest.mock("@/lib/coins", () => ({
  getCoinsConfig: (...args: any[]) => mockGetCoinsConfig(...args),
  chargeMichaelMessage: (...args: any[]) => mockChargeMichaelMessage(...args),
}));

describe("Responses API routes", () => {
  beforeEach(() => {
    mockCreateResponse.mockReset();
    mockGetOrCreateVectorStoreId.mockReset();
    mockGetCoinsConfig.mockReset();
    mockChargeMichaelMessage.mockReset();
    mockGetOrCreateVectorStoreId.mockResolvedValue(null);
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "OFF",
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(0),
    });
    mockChargeMichaelMessage.mockResolvedValue({ ok: true });
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

  it("charges when coins are ON and balance is sufficient", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "ON",
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(0),
    });
    mockChargeMichaelMessage.mockResolvedValue({ ok: true });
    mockCreateResponse.mockResolvedValue({
      id: "resp_final_2",
      output_text: "תשובה",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_coins_on",
        content: "שלום",
        userEmail: "student@example.com",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.responseId).toBe("resp_final_2");
    expect(mockChargeMichaelMessage).toHaveBeenCalledWith("student@example.com");
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
  });

  it("returns 402 when coins are ON and balance is insufficient", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "ON",
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(0),
    });
    mockChargeMichaelMessage.mockResolvedValue({ ok: false, balance: 0, required: 1 });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_no_coins",
        content: "שלום",
        userEmail: "student@example.com",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(402);
    expect(payload).toEqual({
      error: "INSUFFICIENT_COINS",
      message: "Not enough coins",
      balance: 0,
      required: 1,
    });
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });

  it("does not require userEmail or charge when coins are OFF", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "OFF",
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(0),
    });
    mockCreateResponse.mockResolvedValue({
      id: "resp_final_3",
      output_text: "שלום",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_coins_off",
        content: "שלום",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.responseId).toBe("resp_final_3");
    expect(mockChargeMichaelMessage).not.toHaveBeenCalled();
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
  });
});
