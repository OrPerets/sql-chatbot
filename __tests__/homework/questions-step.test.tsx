import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { QuestionsStep } from "@/app/homework/builder/components/wizard/QuestionsStep";
import { HomeworkLocaleProvider } from "@/app/homework/context/HomeworkLocaleProvider";
import { createQuestionDraft } from "@/app/homework/builder/components/wizard/defaults";

describe("QuestionsStep", () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/templates")) {
        return Promise.resolve({
          json: async () => ({ success: true, data: [] }),
        } as Response);
      }

      if (url.includes("/preview-questions")) {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: [
              {
                questionId: "question-1",
                question: {
                  id: "question-1",
                  prompt: "החזירו עובדים עם גיל מעל 30",
                  instructions: "",
                  starterSql: "SELECT * FROM employees WHERE age > 30",
                  expectedOutputDescription: "עובדים מעל 30",
                  expectedResultSchema: [],
                  gradingRubric: [],
                  maxAttempts: 3,
                  points: 10,
                  evaluationMode: "auto",
                },
                variables: [{ variableId: "param-min_age", value: 30, generatedAt: "2026-03-25T10:00:00.000Z" }],
              },
            ],
          }),
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("detects inline tokens and renders preview variants", async () => {
    let currentQuestions = [
      {
        ...createQuestionDraft({ id: "question-1" }),
        expectedOutputDescription: "Describe the result.",
      },
    ];

    const handleChange = jest.fn((nextQuestions) => {
      currentQuestions = nextQuestions;
      rerenderComponent(nextQuestions);
    });

    const renderComponent = (questions = currentQuestions) =>
      render(
        <HomeworkLocaleProvider initialLocale="he">
          <QuestionsStep
            questions={questions}
            onChange={handleChange}
            onBack={jest.fn()}
            onNext={jest.fn()}
            primaryDatasetId="dataset-1"
            setId="set-1"
          />
        </HomeworkLocaleProvider>,
      );

    const { rerender } = renderComponent();
    const rerenderComponent = (questions = currentQuestions) =>
      rerender(
        <HomeworkLocaleProvider initialLocale="he">
          <QuestionsStep
            questions={questions}
            onChange={handleChange}
            onBack={jest.fn()}
            onNext={jest.fn()}
            primaryDatasetId="dataset-1"
            setId="set-1"
          />
        </HomeworkLocaleProvider>,
      );

    fireEvent.change(screen.getByLabelText("ניסוח המשימה"), {
      target: { value: "החזירו עובדים עם גיל מעל {{min_age}}" },
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });

    expect((await screen.findAllByText("min_age")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Preview 3 variants" }));

    expect(await screen.findByText("החזירו עובדים עם גיל מעל 30")).toBeInTheDocument();
    expect(screen.getByText(/min_age: 30/i)).toBeInTheDocument();
  });
});
