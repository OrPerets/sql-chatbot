import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RunnerClient } from "@/app/homework/runner/[setId]/RunnerClient";

const mockGetHomeworkSet = jest.fn();
const mockGetHomeworkQuestions = jest.fn();
const mockGetSubmission = jest.fn();
const mockSaveSubmissionDraft = jest.fn();
const mockSubmitHomework = jest.fn();
const mockGetDataset = jest.fn();
const mockGetHomeworkPersonalization = jest.fn();
const mockGenerateHomeworkPersonalizedQuiz = jest.fn();
const mockTrackHomeworkPersonalizationEvent = jest.fn();
const mockExecuteSql = jest.fn();

jest.mock("@/app/homework/services/homeworkService", () => ({
  getHomeworkSet: (...args: unknown[]) => mockGetHomeworkSet(...args),
  getHomeworkQuestions: (...args: unknown[]) => mockGetHomeworkQuestions(...args),
}));

jest.mock("@/app/homework/services/submissionService", () => ({
  getSubmission: (...args: unknown[]) => mockGetSubmission(...args),
  saveSubmissionDraft: (...args: unknown[]) => mockSaveSubmissionDraft(...args),
  submitHomework: (...args: unknown[]) => mockSubmitHomework(...args),
}));

jest.mock("@/app/homework/services/datasetService", () => ({
  getDataset: (...args: unknown[]) => mockGetDataset(...args),
}));

jest.mock("@/app/homework/services/personalizationService", () => ({
  getHomeworkPersonalization: (...args: unknown[]) => mockGetHomeworkPersonalization(...args),
  generateHomeworkPersonalizedQuiz: (...args: unknown[]) =>
    mockGenerateHomeworkPersonalizedQuiz(...args),
  trackHomeworkPersonalizationEvent: (...args: unknown[]) =>
    mockTrackHomeworkPersonalizationEvent(...args),
}));

jest.mock("@/app/homework/services/sqlService", () => ({
  executeSql: (...args: unknown[]) => mockExecuteSql(...args),
}));

jest.mock("@/app/components/chat", () => ({
  __esModule: true,
  default: () => <div data-testid="embedded-chat">chat</div>,
}));

jest.mock("@/app/homework/runner/[setId]/InstructionsSection", () => ({
  InstructionsSection: ({ title }: { title: string }) => <div>{title}</div>,
}));

jest.mock("@/app/homework/runner/[setId]/RelationalAlgebraEditor", () => ({
  RelationalAlgebraEditor: () => <div data-testid="ra-editor" />,
}));

jest.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: ({ value }: { value?: string }) => <div data-testid="sql-editor">{value}</div>,
}));

jest.mock("@/app/homework/context/HomeworkLocaleProvider", () => ({
  useHomeworkLocale: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      typeof values?.ms === "number" ? `${key}:${values.ms}` : key,
    direction: "rtl",
    formatDateTime: (value: string) => value,
    formatNumber: (value: number) => String(value),
  }),
}));

function renderRunner() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <RunnerClient setId="hw-5" studentId="student-1" />
    </QueryClientProvider>
  );
}

describe("RunnerClient homework sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetHomeworkSet.mockResolvedValue({
      id: "hw-5",
      title: "Homework 5",
      courseId: "course-1",
      dueAt: "2026-04-05T10:00:00.000Z",
      published: true,
      datasetPolicy: "shared",
      questionOrder: ["q-1"],
      visibility: "published",
      createdBy: "instructor-1",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
      backgroundStory: "Story",
      dataStructureNotes: "Structure notes",
    });

    mockGetHomeworkQuestions.mockResolvedValue([
      {
        id: "q-1",
        homeworkSetId: "hw-5",
        prompt: "Write the correct JOIN query",
        instructions: "Use the matching customer id.",
        points: 10,
        maxAttempts: 5,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
      },
    ]);

    mockGetSubmission.mockResolvedValue({
      id: "submission-1",
      homeworkSetId: "hw-5",
      studentId: "student-1",
      attemptNumber: 1,
      answers: {
        "q-1": {
          sql: "select * from orders",
          executionCount: 3,
        },
      },
      overallScore: 0,
      status: "in_progress",
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/users/coins")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            modules: { homeworkHints: false },
            costs: { homeworkHintOpen: 1 },
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the left sidebar focused on Michael chat without personalization UI", async () => {
    renderRunner();

    expect(await screen.findByText("שאל את Michael")).toBeInTheDocument();
    expect(screen.queryByText("מה כדאי לעשות עכשיו?")).not.toBeInTheDocument();
    expect(screen.getByTestId("embedded-chat")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetHomeworkPersonalization).not.toHaveBeenCalled();
      expect(mockGenerateHomeworkPersonalizedQuiz).not.toHaveBeenCalled();
      expect(mockTrackHomeworkPersonalizationEvent).not.toHaveBeenCalled();
    });
  });
});
