import {
  buildSqlDebuggerMvpOutput,
  detectSqlErrorTaxonomy,
  isRevealAnswerEligible,
} from "@/lib/openai/sql-debugger";

describe("sql-debugger taxonomy fixtures", () => {
  it("detects syntax mistakes", () => {
    expect(detectSqlErrorTaxonomy("SELEC * FORM users")).toContain("syntax");
  });

  it("detects null handling mistakes", () => {
    expect(detectSqlErrorTaxonomy("SELECT * FROM users WHERE deleted_at = NULL")).toContain(
      "null_handling_mistake"
    );
  });

  it("enforces reveal threshold", () => {
    expect(isRevealAnswerEligible(2, 3)).toBe(false);
    expect(isRevealAnswerEligible(3, 3)).toBe(true);
  });

  it("returns hint-first output before reveal threshold", () => {
    const output = buildSqlDebuggerMvpOutput({
      studentSql: "SELECT * FROM users WHERE deleted_at = NULL",
      objective: "Find active users",
      schemaContext: "users(id, deleted_at)",
      attemptCount: 1,
    });

    expect(output.hints.length).toBeGreaterThan(0);
    expect(output.fullFix).toBeNull();
  });
});
