import type { HomeworkVisibility, RubricCriterion } from "@/app/homework/types";

export type WizardStepId = "metadata" | "dataset" | "questions" | "rubric" | "publish";

export interface MetadataDraft {
  title: string;
  courseId: string;
  dueAt: string;
  visibility: HomeworkVisibility;
  overview?: string;
  datasetPolicy?: "shared" | "custom";
}

export interface DatasetDraft {
  selectedDatasetId?: string;
}

export type EvaluationMode = "auto" | "manual" | "custom";

export interface QuestionDraft {
  id: string;
  prompt: string;
  instructions: string;
  starterSql: string;
  expectedResultSchema: string;
  points: number;
  maxAttempts: number;
  datasetId?: string;
  rubric: RubricCriterion[];
  evaluationMode: EvaluationMode;
}

export interface HomeworkDraftState {
  metadata: MetadataDraft;
  dataset: DatasetDraft;
  questions: QuestionDraft[];
  publishNotes?: string;
}

export interface WizardControllerState {
  step: WizardStepId;
  setId?: string;
  draft: HomeworkDraftState;
}
