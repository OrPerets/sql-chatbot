/**
 * @jest-environment node
 */

const mockRequireAdmin = jest.fn();
const mockGetAIAnalysisEngine = jest.fn();
const mockAnalyzeStudent = jest.fn();
const mockConnectToDatabase = jest.fn();
const mockRecalculateStudentProfile = jest.fn();
const mockIsStudentProfileInAcademicPeriod = jest.fn();

class MockAdminAuthError extends Error {
  status = 403 as const;
}

jest.mock("@/lib/admin-auth", () => ({
  AdminAuthError: MockAdminAuthError,
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/ai-analysis-engine", () => ({
  getAIAnalysisEngine: (...args: unknown[]) => mockGetAIAnalysisEngine(...args),
}));

jest.mock("@/lib/database", () => ({
  COLLECTIONS: {
    USERS: "users",
  },
  connectToDatabase: (...args: unknown[]) => mockConnectToDatabase(...args),
}));

jest.mock("@/lib/student-profile-recalculation", () => ({
  recalculateStudentProfile: (...args: unknown[]) => mockRecalculateStudentProfile(...args),
}));

jest.mock("@/lib/admin-student-profile-summary", () => ({
  isStudentUserRecord: (user: { email?: string; role?: string }) =>
    Boolean(user.email) && !["admin", "instructor", "teacher", "builder"].includes(String(user.role || "")),
  isStudentProfileInAcademicPeriod: (...args: unknown[]) => mockIsStudentProfileInAcademicPeriod(...args),
}));

function createUsersDb(users: unknown[]) {
  return {
    collection: jest.fn(() => ({
      find: jest.fn(() => ({
        toArray: jest.fn().mockResolvedValue(users),
      })),
    })),
  };
}

describe("admin student profile action routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ email: "admin@example.com" });
    mockGetAIAnalysisEngine.mockResolvedValue({ analyzeStudent: mockAnalyzeStudent });
    mockAnalyzeStudent.mockResolvedValue({ status: "completed" });
    mockConnectToDatabase.mockResolvedValue({ db: createUsersDb([]) });
    mockRecalculateStudentProfile.mockResolvedValue({ created: false });
    mockIsStudentProfileInAcademicPeriod.mockResolvedValue(true);
  });

  it("requires admin session before running issue analysis", async () => {
    mockRequireAdmin.mockRejectedValue(new MockAdminAuthError());

    const { POST } = await import("@/app/api/admin/students/analyze-issues/route");
    const response = await POST(
      new Request("http://localhost/api/admin/students/analyze-issues", {
        method: "POST",
        body: JSON.stringify({ studentId: "student-1" }),
      }) as any
    );

    expect(response.status).toBe(403);
    expect(mockGetAIAnalysisEngine).not.toHaveBeenCalled();
  });

  it("checks selected academic period before running issue analysis", async () => {
    const db = createUsersDb([]);
    mockConnectToDatabase.mockResolvedValue({ db });

    const { POST } = await import("@/app/api/admin/students/analyze-issues/route");
    const response = await POST(
      new Request("http://localhost/api/admin/students/analyze-issues?year=2026&semester=2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: "student-1", analysisType: "manual" }),
      }) as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockIsStudentProfileInAcademicPeriod).toHaveBeenCalledWith(db, "student-1", {
      year: 2026,
      semester: 2,
    });
    expect(mockAnalyzeStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "student-1",
        analysisType: "manual",
      })
    );
    expect(payload.success).toBe(true);
  });

  it("recalculates only student users in the selected cohort", async () => {
    const db = createUsersDb([
      { id: "student-1", email: "student@example.com", year: 2026, semester: 2 },
      { id: "admin-1", email: "admin@example.com", role: "admin", year: 2026, semester: 2 },
    ]);
    mockConnectToDatabase.mockResolvedValue({ db });
    mockRecalculateStudentProfile.mockResolvedValue({ created: true });

    const { POST } = await import("@/app/api/admin/students/calculate-profiles/route");
    const response = await POST(
      new Request("http://localhost/api/admin/students/calculate-profiles?year=2026&semester=2", {
        method: "POST",
      }) as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockRecalculateStudentProfile).toHaveBeenCalledTimes(1);
    expect(mockRecalculateStudentProfile).toHaveBeenCalledWith(db, "student-1");
    expect(payload.data).toEqual(
      expect.objectContaining({
        created: 1,
        updated: 0,
        totalCandidates: 1,
        academicPeriod: { year: 2026, semester: 2 },
      })
    );
  });
});
