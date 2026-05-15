/**
 * @jest-environment node
 */

describe("session auth", () => {
  const originalSecret = process.env.AUTH_SESSION_SECRET;

  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.AUTH_SESSION_SECRET;
    } else {
      process.env.AUTH_SESSION_SECRET = originalSecret;
    }
  });

  it("creates and verifies signed session tokens", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session-auth");
    const token = await createSessionToken({
      userId: "student-1",
      email: "student@example.com",
      role: "student",
    });

    const payload = await verifySessionToken(token);

    expect(payload).toEqual(
      expect.objectContaining({
        sub: "student-1",
        email: "student@example.com",
        role: "student",
        v: 1,
      })
    );
  });

  it("rejects tampered session tokens", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session-auth");
    const token = await createSessionToken({
      userId: "student-1",
      email: "student@example.com",
      role: "student",
    });

    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    const payload = await verifySessionToken(tamperedToken);

    expect(payload).toBeNull();
  });

  it("reads a valid session from request cookies", async () => {
    const { createSessionToken, readSessionFromRequest, SESSION_COOKIE_NAME } = await import(
      "@/lib/session-auth"
    );
    const token = await createSessionToken({
      userId: "admin-1",
      email: "orperets11@gmail.com",
      role: "admin",
    });

    const request = new Request("http://localhost/api/admin/overview", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    const session = await readSessionFromRequest(request);

    expect(session).toEqual(
      expect.objectContaining({
        sub: "admin-1",
        email: "orperets11@gmail.com",
        role: "admin",
      })
    );
  });
});
