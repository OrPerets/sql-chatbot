import type { RubricCriterion } from "@/app/homework/types";
import { generateTempId } from "@/app/homework/utils/id";
import type { HomeworkDraftState, MetadataDraft, QuestionDraft } from "./types";

function createBaseRubric(): RubricCriterion[] {
  return [
    {
      id: generateTempId("rubric"),
      label: "השאילתה מייצרת תוצאה צפויה", // "Query produces expected result"
      description: "בדיקה אוטומטית על ידי השוואת פלט SQL לתוצאה הצפויה", // "Auto-grades by comparing SQL output to expected dataset result"
      weight: 100,
      autoGraded: true,
    },
  ];
}

export function createQuestionDraft(partial?: Partial<QuestionDraft>): QuestionDraft {
  return {
    id: generateTempId("question"),
    prompt: "",
    expectedOutputDescription: "",
    instructions: "",
    starterSql: "",
    expectedResultSchema: "[]",
    points: 10,
    maxAttempts: 3,
    datasetId: undefined,
    rubric: createBaseRubric(),
    evaluationMode: "auto",
    parameterMode: "static",
    parameters: [],
    ...partial,
  };
}

export function createMetadataDraft(partial?: Partial<MetadataDraft>): MetadataDraft {
  const now = new Date();
  const availableFrom = now.toISOString().slice(0, 16);
  const availableUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return {
    title: "מטלת בית ללא כותרת", // "Untitled Homework Set"
    courseId: "",
    availableFrom,
    availableUntil,
    visibility: "draft",
    ...partial,
  };
}

export function createInitialDraft(partial?: Partial<HomeworkDraftState>): HomeworkDraftState {
  return {
    metadata: createMetadataDraft(),
    dataset: {
      selectedDatasetId: undefined,
      backgroundStory: "",
      tags: [],
      ...partial?.dataset,
    },
    questions: Array.from({ length: 3 }, () => createQuestionDraft()),
    publishNotes: "",
    ...partial,
  };
}
