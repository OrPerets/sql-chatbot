/**
 * @jest-environment node
 */

const mockRequireAdmin = jest.fn();
const mockResolveAuthenticatedSession = jest.fn();
const mockListSqlCoinChallenges = jest.fn();
const mockCreateSqlCoinChallenge = jest.fn();
const mockUpdateSqlCoinChallengeStatus = jest.fn();
const mockGetCurrentSqlCoinChallengeForStudent = jest.fn();
const mockGetSqlCoinChallengeForStudent = jest.fn();
const mockSubmitSqlCoinChallenge = jest.fn();

class MockAdminAuthError extends Error {
  status = 403 as const;
}

jest.mock("@/lib/admin-auth", () => ({
  AdminAuthError: MockAdminAuthError,
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/session-auth", () => ({
  resolveAuthenticatedSession: (...args: unknown[]) => mockResolveAuthenticatedSession(...args),
}));

jest.mock("@/lib/sql-coin-challenges", () => ({
  listSqlCoinChallenges: (...args: unknown[]) => mockListSqlCoinChallenges(...args),
  createSqlCoinChallenge: (...args: unknown[]) => mockCreateSqlCoinChallenge(...args),
  updateSqlCoinChallengeStatus: (...args: unknown[]) => mockUpdateSqlCoinChallengeStatus(...args),
  getCurrentSqlCoinChallengeForStudent: (...args: unknown[]) => mockGetCurrentSqlCoinChallengeForStudent(...args),
  getSqlCoinChallengeForStudent: (...args: unknown[]) => mockGetSqlCoinChallengeForStudent(...args),
  submitSqlCoinChallenge: (...args: unknown[]) => mockSubmitSqlCoinChallenge(...args),
}));

describe("SQL coin challenge routes", () => {
  const adminEmail = "orperets11@gmail.com";
  const studentUser = {
    id: "student-1",
    email: "student@example.com",
    year: 2026,
    semester: 2,
  };
  const challenge = {
    id: "sql_coin_1",
    studentEmail: "student@example.com",
    status: "active",
    year: 2026,
    semester: 2,
    questions: [{ queryId: "q1", question: "select", practiceId: "p1" }],
    attempts: [],
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("admin creates a challenge for a selected user in the selected cohort", async () => {
    mockRequireAdmin.mockResolvedValue({ email: adminEmail });
    mockCreateSqlCoinChallenge.mockResolvedValue(challenge);

    const { POST } = await import("@/app/api/admin/coins/challenges/route");
    const request = new Request("http://localhost/api/admin/coins/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentEmail: "student@example.com",
        year: 2026,
        semester: 2,
        questionCount: 3,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.challenge).toEqual(challenge);
    expect(mockCreateSqlCoinChallenge).toHaveBeenCalledWith({
      studentEmail: "student@example.com",
      academicPeriod: { year: 2026, semester: 2 },
      createdBy: adminEmail,
      questionCount: 3,
      practiceId: undefined,
    });
  });

  it("admin challenge listing is scoped by year and semester", async () => {
    mockRequireAdmin.mockResolvedValue({ email: adminEmail });
    mockListSqlCoinChallenges.mockResolvedValue([challenge]);

    const { GET } = await import("@/app/api/admin/coins/challenges/route");
    const response = await GET(new Request("http://localhost/api/admin/coins/challenges?year=2026&semester=2"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.challenges).toEqual([challenge]);
    expect(mockListSqlCoinChallenges).toHaveBeenCalledWith({ year: 2026, semester: 2 });
  });

  it("admin can create a challenge for a privileged test recipient", async () => {
    mockRequireAdmin.mockResolvedValue({ email: adminEmail });
    mockCreateSqlCoinChallenge.mockResolvedValue({
      ...challenge,
      studentEmail: "orperets11@gmail.com",
    });

    const { POST } = await import("@/app/api/admin/coins/challenges/route");
    const request = new Request("http://localhost/api/admin/coins/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentEmail: "orperets11@gmail.com",
        year: 2026,
        semester: 2,
        questionCount: 3,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.challenge.studentEmail).toBe("orperets11@gmail.com");
    expect(mockCreateSqlCoinChallenge).toHaveBeenCalledWith({
      studentEmail: "orperets11@gmail.com",
      academicPeriod: { year: 2026, semester: 2 },
      createdBy: adminEmail,
      questionCount: 3,
      practiceId: undefined,
    });
  });

  it("student current challenge lookup uses the authenticated session user only", async () => {
    mockResolveAuthenticatedSession.mockResolvedValue({
      user: studentUser,
      userId: "student-1",
      session: { email: "student@example.com" },
    });
    mockGetCurrentSqlCoinChallengeForStudent.mockResolvedValue(challenge);

    const { GET } = await import("@/app/api/coins/challenges/me/route");
    const request = new Request("http://localhost/api/coins/challenges/me", {
      headers: {
        "x-user-email": "other@example.com",
      },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.challenge).toEqual(challenge);
    expect(mockGetCurrentSqlCoinChallengeForStudent).toHaveBeenCalledWith(studentUser);
  });

  it("student submit records answers through the authenticated student challenge", async () => {
    mockResolveAuthenticatedSession.mockResolvedValue({
      user: studentUser,
      userId: "student-1",
      session: { email: "student@example.com" },
    });
    mockSubmitSqlCoinChallenge.mockResolvedValue({ ...challenge, status: "completed" });

    const { POST } = await import("@/app/api/coins/challenges/[challengeId]/submit/route");
    const request = new Request("http://localhost/api/coins/challenges/sql_coin_1/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: [{ questionId: "q1", answer: "select * from students" }],
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ challengeId: "sql_coin_1" }) });

    expect(response.status).toBe(200);
    expect(mockSubmitSqlCoinChallenge).toHaveBeenCalledWith({
      challengeId: "sql_coin_1",
      user: studentUser,
      answers: [{ questionId: "q1", answer: "select * from students" }],
    });
  });
});
