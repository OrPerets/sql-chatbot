import {
  buildInlineQuestionPreviews,
  collectQuestionParameterTokens,
  syncQuestionParameters,
} from "@/app/homework/utils/inline-question-parameters";
import { createQuestionDraft } from "@/app/homework/builder/components/wizard/defaults";

describe("inline question parameters", () => {
  it("collects unique tokens across prompt, instructions, and starter SQL", () => {
    const tokens = collectQuestionParameterTokens({
      prompt: "סננו לפי {{min_age}} ו-{{min_age}}",
      instructions: "הציגו גם {{city_name}}",
      starterSql: "WHERE age > {{min_age}} AND city = '{{city_name}}'",
    });

    expect(tokens).toEqual([
      { name: "min_age", sourceFields: ["prompt", "starterSql"] },
      { name: "city_name", sourceFields: ["instructions", "starterSql"] },
    ]);
  });

  it("preserves existing parameter configuration while removing stale params", () => {
    const question = syncQuestionParameters({
      ...createQuestionDraft(),
      prompt: "סננו לפי {{min_age}}",
      parameterMode: "parameterized",
      parameters: [
        {
          id: "param-min_age",
          name: "min_age",
          sourceFields: ["prompt"],
          type: "number",
          constraints: { min: 18, max: 65, step: 1 },
          required: true,
        },
        {
          id: "param-stale",
          name: "stale",
          sourceFields: ["prompt"],
          type: "string",
          constraints: { minLength: 1, maxLength: 4 },
          required: true,
        },
      ],
    });

    expect(question.parameters).toHaveLength(1);
    expect(question.parameters?.[0]).toMatchObject({
      id: "param-min_age",
      name: "min_age",
      constraints: { min: 18, max: 65, step: 1 },
    });
  });

  it("creates deterministic inline previews for the same student and question seed", () => {
    const question = syncQuestionParameters({
      ...createQuestionDraft(),
      prompt: "החזירו עובדים עם גיל מעל {{min_age}}",
      starterSql: "SELECT * FROM employees WHERE age > {{min_age}}",
      expectedOutputDescription: "עובדים מגיל {{min_age}} ומעלה",
      parameterMode: "parameterized",
    }, { forceParameterized: true });

    const previewsA = buildInlineQuestionPreviews(question, {
      homeworkSetId: "hw-1",
      studentId: "student-1",
      sampleCount: 2,
    });
    const previewsB = buildInlineQuestionPreviews(question, {
      homeworkSetId: "hw-1",
      studentId: "student-1",
      sampleCount: 2,
    });

    expect(previewsA).toEqual(previewsB);
    expect(previewsA[0]?.question.prompt).toContain("גיל מעל");
    expect(previewsA[0]?.variables[0]?.value).toBeDefined();
  });
});
