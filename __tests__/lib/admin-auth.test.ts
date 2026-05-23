/**
 * @jest-environment node
 */

const mockResolveAuthenticatedSession = jest.fn();

jest.mock("@/lib/session-auth", () => ({
  resolveAuthenticatedSession: (...args: unknown[]) => mockResolveAuthenticatedSession(...args),
}));

describe("admin auth helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects admin access when there is no authenticated session", async () => {
    mockResolveAuthenticatedSession.mockResolvedValueOnce(null);

    const { requireAdmin, AdminAuthError } = await import("@/lib/admin-auth");

    await expect(requireAdmin(new Request("http://localhost/api/admin/overview"))).rejects.toBeInstanceOf(
      AdminAuthError
    );
  });

  it("allows admin access for allowlisted admin emails from a validated session", async () => {
    mockResolveAuthenticatedSession.mockResolvedValueOnce({
      userId: "admin-1",
      user: {
        id: "admin-1",
        email: "orperets11@gmail.com",
        role: "student",
      },
      session: {
        sub: "admin-1",
        email: "orperets11@gmail.com",
        role: "admin",
      },
    });

    const { requireAdmin } = await import("@/lib/admin-auth");
    const result = await requireAdmin(new Request("http://localhost/api/admin/overview"));

    expect(result).toEqual({ email: "orperets11@gmail.com" });
  });

  it("allows instructor access when the validated session belongs to an instructor", async () => {
    mockResolveAuthenticatedSession.mockResolvedValueOnce({
      userId: "teacher-1",
      user: {
        id: "teacher-1",
        email: "teacher@example.com",
        role: "instructor",
      },
      session: {
        sub: "teacher-1",
        email: "teacher@example.com",
        role: "student",
      },
    });

    const { requireInstructorOrAdmin } = await import("@/lib/admin-auth");
    const result = await requireInstructorOrAdmin(
      new Request("http://localhost/api/responses/messages")
    );

    expect(result).toEqual({
      email: "teacher@example.com",
      role: "instructor",
    });
  });
});
