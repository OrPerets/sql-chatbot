import {
  APPROVED_RUNTIME_MODELS,
  RECOMMENDED_RUNTIME_MODEL,
  RUNTIME_ROLLBACK_TARGETS,
  getDefaultAdminModel,
  getDefaultTutorModel,
  getModelForRole,
  isApprovedRuntimeModel,
} from "@/lib/openai/model-registry";

describe("model-registry", () => {
  it("uses GPT-5.4 mini as the default tutor model", () => {
    expect(getDefaultTutorModel()).toBe("gpt-5.4-mini");
    expect(RECOMMENDED_RUNTIME_MODEL).toBe("gpt-5.4-mini");
  });

  it("uses GPT-5.4 for admin and evaluation work", () => {
    expect(getDefaultAdminModel()).toBe("gpt-5.4");
    expect(getModelForRole("examGeneration")).toBe("gpt-5.4");
    expect(getModelForRole("aiAnalysis")).toBe("gpt-5.4");
  });

  it("publishes approved runtime and rollback targets", () => {
    expect(APPROVED_RUNTIME_MODELS).toEqual(["gpt-5.4-mini", "gpt-5.4"]);
    expect(RUNTIME_ROLLBACK_TARGETS).toEqual(["gpt-5.4-mini", "gpt-5.4", "previous-stable"]);
    expect(isApprovedRuntimeModel("gpt-5.4")).toBe(true);
    expect(isApprovedRuntimeModel("gpt-4.1-mini")).toBe(false);
  });
});
