import { gradeWithRubric } from "@/lib/openai/rubric-grader";
import { executeToolCall, selectToolsForRequest } from "@/lib/openai/tools";

describe("rubric grader", () => {
  it("returns weighted structured scores and guidance", () => {
    const result = gradeWithRubric({
      rubric: [
        {
          id: "correctness",
          label: "Correctness",
          weight: 0.6,
          criteria: "Use correct SQL joins and filtering logic",
          examples: ["JOIN", "WHERE"],
        },
        {
          id: "clarity",
          label: "Clarity",
          weight: 0.4,
          criteria: "Explain rationale clearly and reference expected output",
          examples: ["rationale", "output"],
        },
      ],
      studentResponse: "I used JOIN and WHERE to match rows and explained the expected output rationale.",
    });

    expect(result.success).toBe(true);
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.scores).toHaveLength(2);
    expect(Array.isArray(result.correctionGuidance)).toBe(true);
  });

  it("enforces per-role tool boundaries", async () => {
    const denied = await executeToolCall(
      {
        callId: "1",
        name: "grade_with_rubric",
        argumentsJson: JSON.stringify({ rubric: [], student_response: "test" }),
      },
      {
        toolContext: "admin",
        userRole: "student",
      }
    );

    expect(JSON.parse(denied).error).toContain("not allowed for role");
  });

  it("selects rubric grading tool for grading-oriented admin prompts when enabled", async () => {
    const original = process.env.FF_TOOL_SEARCH_MCP;
    const originalRubricFlag = process.env.FF_SKILL_RUBRIC_GRADER;

    process.env.FF_TOOL_SEARCH_MCP = "1";
    process.env.FF_SKILL_RUBRIC_GRADER = "1";
    jest.resetModules();
    const toolsModule = await import("@/lib/openai/tools");

    const selected = toolsModule.selectToolsForRequest({
      context: "admin",
      role: "admin",
      query: "Please grade this rubric and score the submission",
    });

    expect(selected.reasons.some((entry) => entry.toolName === "grade_with_rubric")).toBe(true);

    process.env.FF_TOOL_SEARCH_MCP = original;
    process.env.FF_SKILL_RUBRIC_GRADER = originalRubricFlag;
    jest.resetModules();
  });
});
