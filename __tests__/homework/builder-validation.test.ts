import { resolveBuilderDashboardStatus, validateHomeworkDraft } from "@/app/homework/builder/components/wizard/validation";
import { createInitialDraft } from "@/app/homework/builder/components/wizard/defaults";

describe("builder validation", () => {
  it("blocks publishing when availability window is invalid and expected output is missing", () => {
    const draft = createInitialDraft();
    draft.metadata.title = "Homework 4";
    draft.metadata.courseId = "SQL-101";
    draft.metadata.availableFrom = "2026-03-10T10:00";
    draft.metadata.availableUntil = "2026-03-09T10:00";
    draft.dataset.selectedDatasetId = "dataset-1";
    draft.questions = [
      {
        ...draft.questions[0]!,
        prompt: "Count rows",
        expectedOutputDescription: "",
        points: 10,
      },
    ];

    const result = validateHomeworkDraft(draft);

    expect(result.canPublish).toBe(false);
    expect(result.blockers).toContain("חלון הזמינות אינו תקין. זמן הפתיחה חייב להיות לפני זמן הסגירה.");
    expect(result.blockers).toContain("שאלה 1: חסר תיאור פלט צפוי.");
  });

  it("allows publishing when required sprint 4 fields are present", () => {
    const draft = createInitialDraft();
    draft.metadata.title = "Homework 4";
    draft.metadata.courseId = "SQL-101";
    draft.metadata.availableFrom = "2026-03-09T10:00";
    draft.metadata.availableUntil = "2026-03-10T10:00";
    draft.metadata.dataStructureNotes = "Explain table relationships.";
    draft.dataset.selectedDatasetId = "dataset-1";
    draft.questions = [
      {
        ...draft.questions[0]!,
        prompt: "Return total sales by customer",
        expectedOutputDescription: "One row per customer with total_sales sorted descending.",
        points: 10,
      },
    ];

    const result = validateHomeworkDraft(draft);

    expect(result.canPublish).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks publishing when parameter constraints are invalid", () => {
    const draft = createInitialDraft();
    draft.metadata.title = "Homework Params";
    draft.metadata.courseId = "SQL-101";
    draft.metadata.availableFrom = "2026-03-09T10:00";
    draft.metadata.availableUntil = "2026-03-10T10:00";
    draft.dataset.selectedDatasetId = "dataset-1";
    draft.questions = [
      {
        ...draft.questions[0]!,
        prompt: "Return employees where age > {{min_age}}",
        expectedOutputDescription: "Employees above the generated threshold.",
        parameterMode: "parameterized",
        parameters: [
          {
            id: "param-min_age",
            name: "min_age",
            sourceFields: ["prompt"],
            type: "number",
            constraints: { min: 50, max: 18, step: 1 },
            required: true,
          },
        ],
      },
    ];

    const result = validateHomeworkDraft(draft);

    expect(result.canPublish).toBe(false);
    expect(result.blockers).toContain("שאלה 1: הטווח של min_age אינו תקין.");
  });

  it("maps dashboard cards into draft, upcoming, open, closed, and archived states", () => {
    expect(resolveBuilderDashboardStatus({ visibility: "draft", published: false })).toBe("draft");
    expect(resolveBuilderDashboardStatus({ visibility: "published", published: true, availabilityState: "upcoming" })).toBe("upcoming");
    expect(resolveBuilderDashboardStatus({ visibility: "published", published: true, availabilityState: "open" })).toBe("open");
    expect(resolveBuilderDashboardStatus({ visibility: "published", published: true, availabilityState: "closed" })).toBe("closed");
    expect(resolveBuilderDashboardStatus({ visibility: "archived", published: true, availabilityState: "open" })).toBe("archived");
  });
});
