/**
 * @jest-environment node
 */

const mockGetAdminStudentEvidenceBundle = jest.fn();
const mockApplyAdminOversightAction = jest.fn();
const mockUpdateKnowledgeScore = jest.fn();

jest.mock("@/lib/admin-student-insights", () => ({
  getAdminStudentEvidenceBundle: (...args: unknown[]) => mockGetAdminStudentEvidenceBundle(...args),
}));

jest.mock("@/lib/student-profiles", () => ({
  applyAdminOversightAction: (...args: unknown[]) => mockApplyAdminOversightAction(...args),
  updateKnowledgeScore: (...args: unknown[]) => mockUpdateKnowledgeScore(...args),
}));

describe("/api/admin/students/[studentId] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the admin evidence bundle for a student", async () => {
    mockGetAdminStudentEvidenceBundle.mockResolvedValue({
      profile: { userId: "student-1" },
      pedagogicalSummary: {
        headline: "Student is weak on joins.",
        rationale: "Recent attempts still fail.",
        topWeakSkill: "JOIN logic",
        confidence: 0.9,
        freshnessLabel: "fresh",
      },
      evidenceConsole: {
        weakSkills: [],
        recentFailedAttempts: [],
        hintUsagePatterns: {
          totalShowAnswerClicks: 0,
          averageTimeToFirstHintMs: null,
          averageAttemptsBeforeHint: null,
          mostSupportedQuestions: [],
        },
        chatMisconceptions: [],
        recommendationHistory: [],
        issueDetections: [],
        fieldTraceability: [],
      },
    });

    const { GET } = await import("@/app/api/admin/students/[studentId]/route");
    const response = await GET(new Request("http://localhost/api/admin/students/student-1") as any, {
      params: Promise.resolve({ studentId: "student-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetAdminStudentEvidenceBundle).toHaveBeenCalledWith("student-1");
    expect(payload.success).toBe(true);
    expect(payload.data.pedagogicalSummary.topWeakSkill).toBe("JOIN logic");
  });

  it("applies admin oversight actions and returns refreshed evidence", async () => {
    mockApplyAdminOversightAction.mockResolvedValue({ userId: "student-1" });
    mockGetAdminStudentEvidenceBundle.mockResolvedValue({
      profile: { userId: "student-1" },
      pedagogicalSummary: {
        headline: "Updated",
        rationale: "Updated",
        topWeakSkill: "JOIN logic",
        confidence: 0.95,
        freshnessLabel: "fresh",
      },
      evidenceConsole: {
        weakSkills: [],
        recentFailedAttempts: [],
        hintUsagePatterns: {
          totalShowAnswerClicks: 0,
          averageTimeToFirstHintMs: null,
          averageAttemptsBeforeHint: null,
          mostSupportedQuestions: [],
        },
        chatMisconceptions: [],
        recommendationHistory: [],
        issueDetections: [],
        fieldTraceability: [],
      },
    });

    const { PUT } = await import("@/app/api/admin/students/[studentId]/route");
    const response = await PUT(
      new Request("http://localhost/api/admin/students/student-1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": "admin@example.com",
        },
        body: JSON.stringify({
          actionType: "confirm_weakness",
          topic: "joins",
          note: "Confirmed from admin screen",
        }),
      }) as any,
      {
        params: Promise.resolve({ studentId: "student-1" }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockApplyAdminOversightAction).toHaveBeenCalledWith(
      "student-1",
      expect.objectContaining({
        actionType: "confirm_weakness",
        topic: "joins",
        createdBy: "admin@example.com",
      })
    );
    expect(payload.success).toBe(true);
  });
});
