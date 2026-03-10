/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST as SAVE_DRAFT } from "@/app/api/homework/[setId]/draft/route";

const mockUpdateHomeworkSet = jest.fn();
const mockUpsertQuestion = jest.fn();
const mockGetQuestionsByHomeworkSet = jest.fn();
const mockDeleteQuestion = jest.fn();

jest.mock("@/lib/homework", () => ({
  updateHomeworkSet: (...args: unknown[]) => mockUpdateHomeworkSet(...args),
}));

jest.mock("@/lib/questions", () => ({
  upsertQuestion: (...args: unknown[]) => mockUpsertQuestion(...args),
  getQuestionsService: jest.fn(async () => ({
    getQuestionsByHomeworkSet: mockGetQuestionsByHomeworkSet,
    deleteQuestion: mockDeleteQuestion,
  })),
}));

jest.mock("@/lib/mutex", () => ({
  globalKeyedMutex: {
    runExclusive: (_key: string, callback: () => Promise<unknown>) => callback(),
  },
}));

describe("/api/homework/[setId]/draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps payload order authoritative and deletes removed questions", async () => {
    mockUpdateHomeworkSet
      .mockResolvedValueOnce({
        id: "set-1",
        title: "HW 1",
      })
      .mockResolvedValueOnce({
        id: "set-1",
        title: "HW 1",
        questionOrder: ["q-2", "q-1"],
      });

    mockGetQuestionsByHomeworkSet.mockResolvedValue([
      { id: "q-1" },
      { id: "q-2" },
      { id: "q-stale" },
    ]);

    mockUpsertQuestion
      .mockResolvedValueOnce({ id: "q-2", prompt: "Second" })
      .mockResolvedValueOnce({ id: "q-1", prompt: "First" });

    const request = new NextRequest("http://localhost:3000/api/homework/set-1/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "HW 1",
        questionOrder: ["q-2", "q-1"],
        questions: [
          { id: "q-2", prompt: "Second", instructions: "2", expectedOutputDescription: "2" },
          { id: "q-1", prompt: "First", instructions: "1", expectedOutputDescription: "1" },
        ],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await SAVE_DRAFT(request, { params: Promise.resolve({ setId: "set-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockDeleteQuestion).toHaveBeenCalledWith("q-stale");
    expect(mockUpdateHomeworkSet).toHaveBeenLastCalledWith("set-1", {
      questionOrder: ["q-2", "q-1"],
    });
    expect(data.questions.map((question: { id: string }) => question.id)).toEqual(["q-2", "q-1"]);
  });

  it("reuses provided ids for new questions so repeated saves stay idempotent", async () => {
    mockUpdateHomeworkSet
      .mockResolvedValueOnce({
        id: "set-2",
        title: "HW 2",
      })
      .mockResolvedValueOnce({
        id: "set-2",
        title: "HW 2",
        questionOrder: ["question-temp-1"],
      });

    mockGetQuestionsByHomeworkSet.mockResolvedValue([]);
    mockUpsertQuestion.mockResolvedValue({
      id: "question-temp-1",
      prompt: "New question",
    });

    const request = new NextRequest("http://localhost:3000/api/homework/set-2/draft", {
      method: "POST",
      body: JSON.stringify({
        title: "HW 2",
        questions: [
          {
            id: "question-temp-1",
            prompt: "New question",
            instructions: "Explain",
            expectedOutputDescription: "Rows",
          },
        ],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await SAVE_DRAFT(request, { params: Promise.resolve({ setId: "set-2" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpsertQuestion).toHaveBeenCalledWith(
      "set-2",
      expect.objectContaining({ id: "question-temp-1" }),
    );
    expect(data.questions[0].id).toBe("question-temp-1");
  });
});
