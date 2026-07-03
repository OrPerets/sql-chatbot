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

  it("returns refreshed balance after a regular SQL practice open without charging coins", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
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
      cost: 0,
      billingDisabled: true,
    });
    expect(mockGetCoinsConfig).not.toHaveBeenCalled();
    expect(mockChargeSqlPracticeOpen).not.toHaveBeenCalled();
  });

  it("does not consult the old SQL practice coin module", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetUserBalance.mockResolvedValue({ user: "student@example.com", coins: 0 });

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

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      currentBalance: 0,
      cost: 0,
      billingDisabled: true,
    });
    expect(mockGetCoinsConfig).not.toHaveBeenCalled();
    expect(mockChargeSqlPracticeOpen).not.toHaveBeenCalled();
  });

  it("does not return 402 for a zero coin balance", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      user: { email: "student@example.com" },
      userId: "student-1",
    });
    mockGetUserBalance.mockResolvedValue({ user: "student@example.com", coins: 0 });

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
      currentBalance: 0,
      cost: 0,
      billingDisabled: true,
    });
    expect(mockChargeSqlPracticeOpen).not.toHaveBeenCalled();
  });
});
