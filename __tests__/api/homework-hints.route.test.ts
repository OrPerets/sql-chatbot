/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockGetCoinsConfig = jest.fn();
const mockChargeHomeworkHintOpen = jest.fn();
const mockGetUserBalance = jest.fn();
const mockRequireAuthenticatedUser = jest.fn();
const mockFindUserByIdOrEmail = jest.fn();

jest.mock("@/lib/coins", () => ({
  getCoinsConfig: (...args: unknown[]) => mockGetCoinsConfig(...args),
  chargeHomeworkHintOpen: (...args: unknown[]) => mockChargeHomeworkHintOpen(...args),
  getUserBalance: (...args: unknown[]) => mockGetUserBalance(...args),
}));

jest.mock("@/lib/request-auth", () => ({
  requireAuthenticatedUser: (...args: unknown[]) => mockRequireAuthenticatedUser(...args),
}));

jest.mock("@/lib/users", () => ({
  getUsersService: jest.fn(async () => ({
    findUserByIdOrEmail: mockFindUserByIdOrEmail,
  })),
}));

describe("/api/homework/hints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a billed placeholder hint when homework hints are enabled", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetCoinsConfig.mockResolvedValue({
      modules: { homeworkHints: true },
    });
    mockChargeHomeworkHintOpen.mockResolvedValue({ ok: true });
    mockGetUserBalance.mockResolvedValue({ user: "student@example.com", coins: 9 });

    const { POST } = await import("@/app/api/homework/hints/route");
    const request = new NextRequest("http://localhost:3000/api/homework/hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: "student-1",
        setId: "set-1",
        questionId: "question-1",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      hint: "רמז לדוגמה: נסו להתחיל מזיהוי הטבלאות הרלוונטיות ולבדוק אילו עמודות דרושות לפתרון.",
      currentBalance: 9,
    });
    expect(mockChargeHomeworkHintOpen).toHaveBeenCalledWith("student@example.com", {
      setId: "set-1",
      questionId: "question-1",
      studentId: "student-1",
    });
  });

  it("returns 403 when homework hints are disabled", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetCoinsConfig.mockResolvedValue({
      modules: { homeworkHints: false },
    });

    const { POST } = await import("@/app/api/homework/hints/route");
    const request = new NextRequest("http://localhost:3000/api/homework/hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: "student-1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("פתיחת רמזים אינה זמינה כרגע.");
    expect(mockChargeHomeworkHintOpen).not.toHaveBeenCalled();
  });

  it("returns 402 when the user does not have enough coins", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetCoinsConfig.mockResolvedValue({
      modules: { homeworkHints: true },
    });
    mockChargeHomeworkHintOpen.mockResolvedValue({ ok: false, balance: 0, required: 1 });

    const { POST } = await import("@/app/api/homework/hints/route");
    const request = new NextRequest("http://localhost:3000/api/homework/hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: "student-1", setId: "set-1", questionId: "question-1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(402);
    expect(payload).toEqual({
      error: "אין מספיק מטבעות",
      balance: 0,
      required: 1,
    });
    expect(mockGetUserBalance).not.toHaveBeenCalled();
  });
});
