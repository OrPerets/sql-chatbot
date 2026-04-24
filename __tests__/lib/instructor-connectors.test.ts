describe("instructor connectors", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it("keeps instructor connectors disabled when the feature flag is off", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "0";
    process.env.OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN = "drive-token";

    const module = await import("@/lib/openai/instructor-connectors");
    const capabilities = await module.getInstructorConnectorCapabilities();
    const tools = await module.buildInstructorConnectorTools();

    expect(capabilities.every((entry) => entry.status === "feature_flag_disabled")).toBe(true);
    expect(tools).toEqual([]);
  });

  it("builds read-only first-wave connector tools when auth tokens are configured", async () => {
    process.env.FEATURE_OPENAI_CONNECTORS = "1";
    process.env.OPENAI_CONNECTOR_GOOGLE_DRIVE_TOKEN = "drive-token";
    process.env.OPENAI_CONNECTOR_GMAIL_TOKEN = "gmail-token";
    process.env.OPENAI_CONNECTOR_GOOGLE_CALENDAR_TOKEN = "calendar-token";

    const module = await import("@/lib/openai/instructor-connectors");
    const capabilities = await module.getInstructorConnectorCapabilities();
    const tools = await module.buildInstructorConnectorTools();

    expect(capabilities.find((entry) => entry.id === "google_drive")?.status).toBe("ready");
    expect(capabilities.find((entry) => entry.id === "gmail")?.status).toBe("ready");
    expect(capabilities.find((entry) => entry.id === "google_calendar")?.status).toBe("ready");
    expect(capabilities.find((entry) => entry.id === "google_sheets_tabular")?.status).toBe("ready");

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "mcp",
          server_label: "Google Drive",
          connector_id: "connector_googledrive",
          allowed_tools: ["search", "fetch", "recent_documents"],
        }),
        expect.objectContaining({
          type: "mcp",
          server_label: "Gmail",
          connector_id: "connector_gmail",
          allowed_tools: ["search_emails", "get_recent_emails", "read_email", "batch_read_email"],
        }),
        expect.objectContaining({
          type: "mcp",
          server_label: "Google Calendar",
          connector_id: "connector_googlecalendar",
          allowed_tools: ["search_events", "read_event"],
        }),
      ])
    );
  });
});
