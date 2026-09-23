/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST as PREVIEW_QUESTIONS } from "@/app/api/homework/[setId]/students/[studentId]/preview-questions/route";

describe("/api/homework/[setId]/students/[studentId]/preview-questions", () => {
  it("previews inline-authored parameterized questions without template ids", async () => {
    const request = new NextRequest("http://localhost:3000/api/homework/set-1/students/student-1/preview-questions", {
      method: "POST",
      body: JSON.stringify({
        sampleCount: 2,
        inlineQuestions: [
          {
            id: "question-1",
            prompt: "Return employees where age > {{min_age}}",
            instructions: "",
            starterSql: "SELECT * FROM employees WHERE age > {{min_age}}",
            expectedOutputDescription: "Employees over {{min_age}}",
            expectedResultSchema: [],
            gradingRubric: [],
            maxAttempts: 3,
            points: 10,
            evaluationMode: "auto",
            parameterMode: "parameterized",
            parameters: [
              {
                id: "param-min_age",
                name: "min_age",
                sourceFields: ["prompt", "starterSql"],
                type: "number",
                constraints: { min: 18, max: 65, step: 1 },
                required: true,
              },
            ],
          },
        ],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await PREVIEW_QUESTIONS(request, {
      params: Promise.resolve({ setId: "set-1", studentId: "student-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].question.prompt).toMatch(/age > \d+/);
    expect(data.data[0].variables[0].variableId).toBe("param-min_age");
  });
});
