/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockGetCoinsConfig = jest.fn();
const mockChargeSqlPracticeOpen = jest.fn();
const mockGetUserBalance = jest.fn();
const mockRequireAuthenticatedUser = jest.fn();
const mockFindUserByIdOrEmail = jest.fn();

jest.mock("@/lib/coins", () => ({
  getCoinsConfig: (...args: unknown[]) => mockGetCoinsConfig(...args),
  chargeSqlPracticeOpen: (...args: unknown[]) => mockChargeSqlPracticeOpen(...args),
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

describe("/api/practice/coins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns refreshed balance after a successful billed SQL practice open", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetCoinsConfig.mockResolvedValue({
      modules: { sqlPractice: true },
      costs: { sqlPracticeOpen: 1 },
    });
    mockChargeSqlPracticeOpen.mockResolvedValue({ ok: true });
    mockGetUserBalance.mockResolvedValue({ user: "student@example.com", coins: 8 });

    const { POST } = await import("@/app/api/practice/coins/route");
    const request = new NextRequest("http://localhost:3000/api/practice/coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "student-1",
      },
      body: JSON.stringify({ userId: "student-1", entryPoint: "chat" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      currentBalance: 8,
      cost: 1,
    });
    expect(mockChargeSqlPracticeOpen).toHaveBeenCalledWith("student@example.com", {
      entryPoint: "chat",
      userId: "student-1",
    });
  });

  it("returns 403 when SQL practice is disabled", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetCoinsConfig.mockResolvedValue({
      modules: { sqlPractice: false },
      costs: { sqlPracticeOpen: 1 },
    });

    const { POST } = await import("@/app/api/practice/coins/route");
    const request = new NextRequest("http://localhost:3000/api/practice/coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "student-1",
      },
      body: JSON.stringify({ userId: "student-1" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("תרגול SQL אינו זמין כרגע.");
    expect(mockChargeSqlPracticeOpen).not.toHaveBeenCalled();
  });

  it("returns 402 when the user does not have enough coins", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetCoinsConfig.mockResolvedValue({
      modules: { sqlPractice: true },
      costs: { sqlPracticeOpen: 1 },
    });
    mockChargeSqlPracticeOpen.mockResolvedValue({ ok: false, balance: 0, required: 1 });

    const { POST } = await import("@/app/api/practice/coins/route");
    const request = new NextRequest("http://localhost:3000/api/practice/coins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "student-1",
      },
      body: JSON.stringify({ userId: "student-1", entryPoint: "chat" }),
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
