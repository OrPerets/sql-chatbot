/**
 * @jest-environment node
 */

const mockCreateResponse = jest.fn();
const mockGetOrCreateVectorStoreId = jest.fn();
const mockGetCoinsConfig = jest.fn();
const mockChargeMainChatMessage = jest.fn();
const mockGetChatMessages = jest.fn();
const mockGetStudentPersonalizationBundle = jest.fn();

jest.mock("@/lib/openai/api-mode", () => ({
  getOpenAIApiMode: () => "responses",
  isResponsesMode: () => true,
}));

jest.mock("@/lib/openai/responses-client", () => ({
  createResponse: (...args: any[]) => mockCreateResponse(...args),
  streamResponse: jest.fn(),
  extractOutputText: (response: any) => response?.output_text || "",
  extractSqlTutorResponse: jest.fn(() => null),
  extractRelationalAlgebraTutorResponse: jest.fn(() => null),
  getSqlTutorResponseFormat: jest.fn(() => ({ type: "json_schema" })),
  getRelationalAlgebraTutorResponseFormat: jest.fn(() => ({ type: "json_schema" })),
}));

jest.mock("@/lib/openai/vector-store", () => ({
  getOrCreateAppVectorStoreId: (...args: any[]) => mockGetOrCreateVectorStoreId(...args),
  buildFileSearchTool: (vectorStoreId: string) => ({ type: "file_search", vector_store_ids: [vectorStoreId] }),
}));

jest.mock("@/app/agent-config", () => ({
  getAgentTools: () => [{ type: "function", name: "get_course_week_context", parameters: { type: "object" } }],
  getAgentToolsForContext: (context: string) =>
    context === "admin"
      ? [{ type: "web_search" }]
      : [{ type: "function", name: "get_course_week_context", parameters: { type: "object" } }],
}));

jest.mock("@/lib/openai/tools", () => ({
  executeToolCall: jest.fn(),
}));

jest.mock("@/lib/personalization", () => ({
  getStudentPersonalizationBundle: (...args: any[]) => mockGetStudentPersonalizationBundle(...args),
}));

jest.mock("@/lib/chat", () => ({
  getChatMessages: (...args: any[]) => mockGetChatMessages(...args),
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
  chargeMainChatMessage: (...args: any[]) => mockChargeMainChatMessage(...args),
}));

describe("Responses API routes", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreateResponse.mockReset();
    mockGetOrCreateVectorStoreId.mockReset();
    mockGetCoinsConfig.mockReset();
    mockChargeMainChatMessage.mockReset();
    mockGetChatMessages.mockReset();
    mockGetOrCreateVectorStoreId.mockResolvedValue(null);
    mockGetChatMessages.mockResolvedValue([]);
    mockGetStudentPersonalizationBundle.mockReset();
    mockGetStudentPersonalizationBundle.mockResolvedValue({
      snapshot: {
        studentId: "student@example.com",
        generatedAt: "2026-03-31T10:00:00.000Z",
        knowledgeScore: "needs_attention",
        recentTrend: "declining",
        strengths: [],
        weaknesses: [
          { topic: "joins", label: "JOIN logic", kind: "weakness", score: 8, reasons: ["Recurring challenge: JOIN logic"] },
        ],
        quizSummary: {
          totalAttempts: 2,
          bestScore: 60,
          lastScore: 55,
          lastCompletedAt: "2026-03-30T10:00:00.000Z",
          averageScore: 58,
          topicsToRevisit: ["JOIN logic"],
        },
        engagementSummary: {
          lastActivityAt: "2026-03-31T09:00:00.000Z",
          chatSessions: 2,
          helpRequests: 1,
          homeworkSubmissions: 1,
        },
        riskSummary: {
          isAtRisk: true,
          riskLevel: "high",
          reasons: ["Repeated failed attempts"],
        },
        preferenceSummary: {
          preferredLanguage: "he",
          preferredExplanationDepth: null,
          examPrepGoals: null,
          repeatedWeaknesses: ["JOIN logic"],
        },
      },
      recentAttempts: {
        studentId: "student@example.com",
        generatedAt: "2026-03-31T10:00:00.000Z",
        attempts: [],
        repeatedMistakeThemes: ["JOIN logic"],
      },
      deadlines: {
        studentId: "student@example.com",
        generatedAt: "2026-03-31T10:00:00.000Z",
        currentHomework: null,
        sameCourseDeadlines: [],
      },
      recommendation: {
        studentId: "student@example.com",
        generatedAt: "2026-03-31T10:00:00.000Z",
        primary: {
          id: "rec-1",
          type: "review_topic",
          title: "Review JOIN logic",
          rationale: "Recurring JOIN mistakes were detected.",
          urgency: "high",
          score: 80,
          action: {
            type: "review_topic",
            label: "Review JOIN logic",
            topic: "JOIN logic",
          },
        },
        alternatives: [],
        reasoningSummary: [],
      },
    });
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "OFF",
      messageCost: 1,
      starterBalance: 20,
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      modules: { mainChat: false, homeworkHints: false, sqlPractice: false },
      updatedAt: new Date(0),
    });
    mockChargeMainChatMessage.mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    process.env = originalEnv;
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
    expect(payload.error).toContain("Either content, imageData, or fileIds is required");
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
    expect(payload.metadata).toMatchObject({
      canonicalStateStrategy: "previous_response_id",
      sessionId: "sess_test_1",
      responseId: "resp_final_1",
      previousResponseId: "resp_prev_1",
      store: true,
      truncation: "auto",
      promptCacheKey: "michael:main:chat:direct:text",
      retrievalUsed: false,
    });
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
    expect(mockCreateResponse.mock.calls[0][0].toolChoice).toEqual({
      type: "function",
      name: "get_course_week_context",
    });
    expect(mockCreateResponse.mock.calls[0][0].reasoning).toEqual({ summary: "detailed" });
    expect(mockCreateResponse.mock.calls[0][0].input[0].content[0].text).toBe("היי");
    expect(mockCreateResponse.mock.calls[0][0]).toMatchObject({
      include: ["file_search_call.results"],
      store: true,
      truncation: "auto",
      promptCacheKey: "michael:main:chat:direct:text",
    });
    expect(mockCreateResponse.mock.calls[0][0].tools).toEqual([
      { type: "function", name: "get_course_week_context", parameters: { type: "object" } },
      { type: "file_search", vector_store_ids: ["vs_1"] },
    ]);
  });

  it("preloads personalization evidence for weakness questions in main chat", async () => {
    mockGetOrCreateVectorStoreId.mockResolvedValue(null);
    mockCreateResponse.mockResolvedValue({
      id: "resp_personal_1",
      output_text: "אתה מתקשה בעיקר ב-JOIN.",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_personal_1",
        content: "איפה אני מתקשה בחומר?",
        userEmail: "student@example.com",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.outputText).toBe("אתה מתקשה בעיקר ב-JOIN.");
    expect(mockGetStudentPersonalizationBundle).toHaveBeenCalledWith({
      studentId: "student@example.com",
      homeworkSetId: undefined,
      questionId: undefined,
    });
    expect(mockCreateResponse.mock.calls[0][0].extraInstructions).toContain("[PRELOADED PERSONALIZATION DATA]");
    expect(mockCreateResponse.mock.calls[0][0].extraInstructions).toContain("JOIN logic");
  });

  it("prefers metadata student_id over userEmail for main-chat personalization preload", async () => {
    mockGetOrCreateVectorStoreId.mockResolvedValue(null);
    mockCreateResponse.mockResolvedValue({
      id: "resp_personal_2",
      output_text: "אתה מתקשה בעיקר ב-JOIN.",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_personal_2",
        content: "איפה אני מתקשה בחומר?",
        userEmail: "student@example.com",
        stream: false,
        metadata: {
          student_id: "student_123",
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.outputText).toBe("אתה מתקשה בעיקר ב-JOIN.");
    expect(mockGetStudentPersonalizationBundle).toHaveBeenCalledWith({
      studentId: "student_123",
      homeworkSetId: undefined,
      questionId: undefined,
    });
  });

  it("switches to relational algebra tutor mode when requested by metadata", async () => {
    mockGetOrCreateVectorStoreId.mockResolvedValue(null);
    mockCreateResponse.mockResolvedValue({
      id: "resp_ra_1",
      output_text: "RA explanation",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_ra_1",
        content: "הסבר לי את זה",
        stream: false,
        metadata: {
          subject_mode: "relational_algebra",
          tutor_mode: "true",
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.responseId).toBe("resp_ra_1");
    expect(mockCreateResponse.mock.calls[0][0].promptCacheKey).toBe(
      "michael:main:relational_algebra_tutor:direct:text"
    );
    expect(mockCreateResponse.mock.calls[0][0].extraInstructions).toContain(
      "[RELATIONAL ALGEBRA TUTORING MODE]"
    );
  });

  it("allows admin context to include web_search and returns url citations", async () => {
    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_admin_1",
      output_text: "Latest docs update [1]",
      output: [
        {
          type: "web_search_call",
          id: "ws_1",
          status: "completed",
          queries: ["latest sql docs update"],
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Latest docs update [1]",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.com/docs",
                  title: "SQL Docs",
                  start_index: 0,
                  end_index: 20,
                },
              ],
            },
          ],
        },
      ],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "orperets11@gmail.com",
      },
      body: JSON.stringify({
        sessionId: "sess_admin_1",
        content: "What changed in the latest SQL docs?",
        context: "admin",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.citations).toEqual([
      expect.objectContaining({
        type: "url_citation",
        url: "https://example.com/docs",
        title: "SQL Docs",
      }),
    ]);
    expect(payload.metadata).toMatchObject({
      webSearchQueries: ["latest sql docs update"],
      webSearchCallCount: 1,
      webSearchSourceCount: 1,
      promptCacheKey: "michael:admin:chat:direct:text",
    });
    expect(mockCreateResponse.mock.calls[0][0].tools).toEqual([
      { type: "web_search" },
      { type: "file_search", vector_store_ids: ["vs_1"] },
    ]);
  });

  it("supports Drive-backed instructor retrieval with connector metadata", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "1";
    process.env.OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN = "drive-token";

    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_drive_1",
      output_text: "I found the course note in Drive.",
      output: [
        {
          type: "mcp_call",
          server_label: "Google Drive",
          name: "search",
          arguments: "{\"query\":\"week 4 joins\"}",
          output: "{\"results\":[]}",
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "I found the course note in Drive.",
              annotations: [],
            },
          ],
        },
      ],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "orperets11@gmail.com",
      },
      body: JSON.stringify({
        sessionId: "sess_drive_1",
        content: "Find the lecture note about joins in Drive",
        context: "admin",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.metadata).toMatchObject({
      connectorCallCount: 1,
      connectorUsage: [
        {
          label: "Google Drive",
          toolNames: ["search"],
          callCount: 1,
        },
      ],
    });
    expect(mockCreateResponse.mock.calls[0][0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "mcp",
          server_label: "Google Drive",
          connector_id: "connector_googledrive",
        }),
      ])
    );
  });

  it("supports Calendar-backed deadline lookup with connector metadata", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "1";
    process.env.OPENAI_CONNECTOR_GOOGLE_CALENDAR_TOKEN = "calendar-token";

    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_calendar_1",
      output_text: "The homework is due tomorrow.",
      output: [
        {
          type: "mcp_call",
          server_label: "Google Calendar",
          name: "search_events",
          arguments: "{\"query\":\"homework deadline\"}",
          output: "{\"events\":[]}",
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "The homework is due tomorrow.",
              annotations: [],
            },
          ],
        },
      ],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "orperets11@gmail.com",
      },
      body: JSON.stringify({
        sessionId: "sess_calendar_1",
        content: "What deadline is on the teaching calendar this week?",
        context: "admin",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.metadata).toMatchObject({
      connectorCallCount: 1,
      connectorUsage: [
        {
          label: "Google Calendar",
          toolNames: ["search_events"],
          callCount: 1,
        },
      ],
    });
  });

  it("supports Gmail-backed clarification lookup with connector metadata", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "1";
    process.env.OPENAI_CONNECTOR_GMAIL_TOKEN = "gmail-token";

    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_gmail_1",
      output_text: "I found the clarification email.",
      output: [
        {
          type: "mcp_call",
          server_label: "Gmail",
          name: "search_emails",
          arguments: "{\"query\":\"subject:homework clarification\"}",
          output: "{\"messages\":[]}",
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "I found the clarification email.",
              annotations: [],
            },
          ],
        },
      ],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "orperets11@gmail.com",
      },
      body: JSON.stringify({
        sessionId: "sess_gmail_1",
        content: "Find the latest clarification email about homework",
        context: "admin",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.metadata).toMatchObject({
      connectorCallCount: 1,
      connectorUsage: [
        {
          label: "Gmail",
          toolNames: ["search_emails"],
          callCount: 1,
        },
      ],
    });
  });

  it("allows privileged instructor access to admin-context connectors", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "1";
    process.env.OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN = "drive-token";

    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_instructor_1",
      output_text: "Instructor lookup complete.",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "teacher@example.com",
        cookie: "michael-role=instructor",
      },
      body: JSON.stringify({
        sessionId: "sess_instructor_1",
        content: "Find the worksheet in Drive",
        context: "admin",
        stream: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCreateResponse.mock.calls[0][0].tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "mcp",
          server_label: "Google Drive",
        }),
      ])
    );
  });

  it("rejects student attempts to use admin-context connectors", async () => {
    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": "student@example.com",
      },
      body: JSON.stringify({
        sessionId: "sess_student_admin",
        content: "Try admin connectors",
        context: "admin",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });

  it("keeps connectors out of student chat even when the feature flag is enabled", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "1";
    process.env.OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN = "drive-token";
    process.env.OPENAI_CONNECTOR_GMAIL_TOKEN = "gmail-token";
    process.env.OPENAI_CONNECTOR_GOOGLE_CALENDAR_TOKEN = "calendar-token";

    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_student_1",
      output_text: "Student-safe response",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_student_1",
        content: "Help me with SQL joins",
        stream: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCreateResponse.mock.calls[0][0].tools).toEqual([
      { type: "function", name: "get_course_week_context", parameters: { type: "object" } },
      { type: "file_search", vector_store_ids: ["vs_1"] },
    ]);
  });

  it("disables reasoning when thinkingMode is false", async () => {
    mockGetOrCreateVectorStoreId.mockResolvedValue("vs_1");
    mockCreateResponse.mockResolvedValue({
      id: "resp_final_2",
      output_text: "היי",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_test_2",
        content: "היי",
        thinkingMode: false,
        stream: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
    expect(mockCreateResponse.mock.calls[0][0].reasoning).toBeUndefined();
  });

  it("builds fallback input from stored chat history when chatId is provided", async () => {
    mockGetChatMessages.mockResolvedValue([
      { role: "user", text: "מה מותר בשבוע 3?" },
      { role: "assistant", text: "בשבוע 3 מותר JOIN בסיסי." },
    ]);
    mockCreateResponse.mockResolvedValue({
      id: "resp_final_history",
      output_text: "זו תשובת המשך",
      output: [],
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_history",
        chatId: "chat_123",
        previousResponseId: "resp_prev_history",
        content: "תזכיר לי גם מה יש בעמודות",
        stream: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockGetChatMessages).toHaveBeenCalledWith("chat_123");
    expect(mockCreateResponse.mock.calls[0][0].fallbackInput).toEqual([
      { role: "user", content: [{ type: "input_text", text: "מה מותר בשבוע 3?" }] },
      { role: "assistant", content: [{ type: "input_text", text: "בשבוע 3 מותר JOIN בסיסי." }] },
      { role: "user", content: [{ type: "input_text", text: "תזכיר לי גם מה יש בעמודות" }] },
    ]);
  });

  it("charges when main chat coins are enabled and balance is sufficient", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "ON",
      messageCost: 1,
      starterBalance: 20,
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      modules: { mainChat: true, homeworkHints: false, sqlPractice: false },
      updatedAt: new Date(0),
    });
    mockChargeMainChatMessage.mockResolvedValue({ ok: true });
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
    expect(mockChargeMainChatMessage).toHaveBeenCalledWith("student@example.com", {
      sessionId: "sess_coins_on",
      hasImage: false,
    });
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
  });

  it("returns 402 when main chat coins are enabled and balance is insufficient", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "ON",
      messageCost: 1,
      starterBalance: 20,
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      modules: { mainChat: true, homeworkHints: false, sqlPractice: false },
      updatedAt: new Date(0),
    });
    mockChargeMainChatMessage.mockResolvedValue({ ok: false, balance: 0, required: 1 });

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

  it("does not require userEmail or charge when main chat billing is disabled", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "ON",
      messageCost: 1,
      starterBalance: 20,
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      modules: { mainChat: false, homeworkHints: true, sqlPractice: true },
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
    expect(mockChargeMainChatMessage).not.toHaveBeenCalled();
    expect(mockCreateResponse).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when main chat billing is enabled and userEmail is missing", async () => {
    mockGetCoinsConfig.mockResolvedValue({
      sid: "admin",
      status: "ON",
      messageCost: 1,
      starterBalance: 20,
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      modules: { mainChat: true, homeworkHints: false, sqlPractice: false },
      updatedAt: new Date(0),
    });

    const { POST } = await import("../../app/api/responses/messages/route");
    const request = new Request("http://localhost:3000/api/responses/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_missing_email",
        content: "שלום",
        stream: false,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("userEmail required when coins are ON");
    expect(mockChargeMainChatMessage).not.toHaveBeenCalled();
    expect(mockCreateResponse).not.toHaveBeenCalled();
  });
});
