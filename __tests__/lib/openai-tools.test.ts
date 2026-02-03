/**
 * @jest-environment node
 */

jest.mock("@/lib/content", () => ({
  getCurrentWeekContextNormalized: jest.fn(),
  getWeekContextByNumberNormalized: jest.fn(),
}));

jest.mock("@/lib/sql-curriculum", () => ({
  SQL_CURRICULUM_MAP: {
    1: { week: 1, concepts: [], forbiddenConcepts: [] },
    13: { week: 13, concepts: [], forbiddenConcepts: [] },
  },
  getAllowedConceptsForWeek: jest.fn().mockReturnValue(["SELECT", "JOIN"]),
  getForbiddenConceptsForWeek: jest.fn().mockReturnValue([]),
}));

describe("openai tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pins auto week to last curriculum week after semester end", async () => {
    const { getCurrentWeekContextNormalized, getWeekContextByNumberNormalized } = await import(
      "@/lib/content"
    );
    (getCurrentWeekContextNormalized as jest.Mock).mockResolvedValue({
      weekNumber: 14,
      content: null,
      dateRange: null,
      updatedAt: null,
      updatedBy: null,
    });
    (getWeekContextByNumberNormalized as jest.Mock).mockResolvedValue({
      weekNumber: 13,
      content: "Final week",
      dateRange: "2024-04-01 - 2024-04-07",
      updatedAt: null,
      updatedBy: null,
    });

    const { executeToolCall } = await import("@/lib/openai/tools");
    const out = await executeToolCall({
      callId: "call_1",
      name: "get_course_week_context",
      argumentsJson: "{}",
    });

    const payload = JSON.parse(out);
    expect(payload.weekNumber).toBe(13);
    expect(getWeekContextByNumberNormalized).toHaveBeenCalledWith(13);
  });
});
