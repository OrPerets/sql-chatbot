/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockGetLearningNote = jest.fn();
const mockUpsertLearningNote = jest.fn();
const mockRequireAuthenticatedUser = jest.fn();

jest.mock("@/lib/learning-notes", () => ({
  getLearningNote: (...args: unknown[]) => mockGetLearningNote(...args),
  upsertLearningNote: (...args: unknown[]) => mockUpsertLearningNote(...args),
}));

jest.mock("@/lib/request-auth", () => ({
  requireAuthenticatedUser: (...args: unknown[]) => mockRequireAuthenticatedUser(...args),
}));

describe("/api/learning/notes video notes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({
      ok: true,
      userId: "student-1",
      user: { email: "student@example.com" },
    });
  });

  it("loads the note for a specific video", async () => {
    mockGetLearningNote.mockResolvedValue({
      userId: "student-1",
      targetType: "video",
      targetId: "inner-join",
      content: "INNER JOIN keeps matching rows.",
    });

    const { GET } = await import("@/app/api/learning/notes/route");
    const request = new NextRequest(
      "http://localhost:3000/api/learning/notes?userId=student-1&targetType=video&targetId=inner-join",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.note.content).toBe("INNER JOIN keeps matching rows.");
    expect(mockRequireAuthenticatedUser).toHaveBeenCalledWith(request, "student-1");
    expect(mockGetLearningNote).toHaveBeenCalledWith("student-1", "video", "inner-join");
  });

  it("saves notes independently by video id", async () => {
    mockUpsertLearningNote.mockResolvedValue({
      userId: "student-1",
      targetType: "video",
      targetId: "left-join",
      content: "LEFT keeps every row from the left table.",
    });

    const { PUT } = await import("@/app/api/learning/notes/route");
    const request = new NextRequest("http://localhost:3000/api/learning/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "student-1",
        targetType: "video",
        targetId: "left-join",
        content: "LEFT keeps every row from the left table.",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mockUpsertLearningNote).toHaveBeenCalledWith(
      "student-1",
      "video",
      "left-join",
      "LEFT keeps every row from the left table.",
    );
  });

  it("rejects unsupported note target types", async () => {
    const { PUT } = await import("@/app/api/learning/notes/route");
    const request = new NextRequest("http://localhost:3000/api/learning/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "student-1",
        targetType: "unknown",
        targetId: "inner-join",
        content: "note",
      }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(400);
    expect(mockUpsertLearningNote).not.toHaveBeenCalled();
  });
});
