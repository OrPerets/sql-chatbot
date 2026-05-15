import { renderQuestionVariables } from "@/lib/question-variable-rendering";
import type { Question } from "@/app/homework/types";

function createQuestion(partial: Partial<Question>): Question {
  return {
    id: "question-1",
    prompt: "שאלה 1",
    instructions: "",
    expectedResultSchema: [],
    gradingRubric: [],
    maxAttempts: 3,
    points: 10,
    ...partial,
  };
}

describe("question variable rendering", () => {
  it("renders legacy placeholder questions with deterministic values", () => {
    const question = createQuestion({
      instructions: "נולדו בין {{start_year}} ל-{{end_year}} ושכר בין {{min_salary}} ל-{{max_salary}}.",
      starterSql: "WHERE salary > {{min_salary}} AND salary < {{max_salary}}",
    });

    const rendered = renderQuestionVariables(question, {
      homeworkSetId: "set-1",
      studentId: "student-1",
    });

    expect(rendered.instructions).not.toContain("{{");
    expect(rendered.starterSql).not.toContain("{{");
    expect(rendered.variables).toHaveLength(4);
  });

  it("uses existing variable values when they are already stored on the question", () => {
    const question = createQuestion({
      instructions: "שכר מעל {{min_salary}}.",
      variables: [{ variableId: "min_salary", value: 7500, generatedAt: "2026-01-01T00:00:00.000Z" }],
    });

    const rendered = renderQuestionVariables(question, {
      homeworkSetId: "set-1",
      studentId: "student-1",
    });

    expect(rendered.instructions).toBe("שכר מעל 7500.");
  });
});
