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

  it("renders legacy HW2 country placeholders as country names in the prompt and state codes in RA", () => {
    const question = createQuestion({
      prompt: "הציגו את שמות האוניברסיטאות שנמצאות ב-{{country_1}}, {{country_2}} ו-{{country_3}}.",
      starterSql:
        "π universityName (σ state = '{{country_1}}' (Universities))\n" +
        "∪ π universityName (σ state = '{{country_2}}' (Universities))\n" +
        "∪ π universityName (σ state = '{{country_3}}' (Universities))",
    });

    const rendered = renderQuestionVariables(question, {
      homeworkSetId: "69aabdacafa3dcd3648446e2",
      studentId: "orperets11@gmail.com",
    });

    expect(rendered.prompt).toContain("איטליה, פורטוגל וספרד");
    expect(rendered.prompt).not.toContain("{{");
    expect(rendered.starterSql).toContain("state = 'IT'");
    expect(rendered.starterSql).toContain("state = 'PO'");
    expect(rendered.starterSql).toContain("state = 'SP'");
    expect(rendered.starterSql).not.toContain("{{");
  });
});
