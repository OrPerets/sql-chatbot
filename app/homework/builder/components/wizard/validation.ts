import type { HomeworkAvailabilityState } from "@/app/homework/types";
import type { HomeworkDraftState, MetadataDraft, QuestionDraft } from "./types";

export interface QuestionValidationSummary {
  id: string;
  index: number;
  hasPrompt: boolean;
  hasExpectedOutput: boolean;
  hasPoints: boolean;
  hasRubric: boolean;
  isParametric: boolean;
}

export interface DraftValidationSummary {
  blockers: string[];
  warnings: string[];
  questionSummaries: QuestionValidationSummary[];
  canPublish: boolean;
}

export type BuilderDashboardStatus = "draft" | "upcoming" | "open" | "closed" | "archived";

export function hasValidAvailabilityWindow(metadata: MetadataDraft): boolean {
  if (!metadata.availableFrom || !metadata.availableUntil) {
    return false;
  }

  return new Date(metadata.availableFrom).getTime() < new Date(metadata.availableUntil).getTime();
}

function validateQuestion(question: QuestionDraft, index: number): QuestionValidationSummary {
  let schema: Array<{ column: string; type?: string }> = [];
  try {
    schema = JSON.parse(question.expectedResultSchema || "[]");
  } catch {
    schema = [];
  }

  return {
    id: question.id,
    index,
    hasPrompt: Boolean(question.prompt.trim()),
    hasExpectedOutput:
      Boolean(question.expectedOutputDescription.trim()) ||
      schema.some((entry) => typeof entry?.column === "string" && entry.column.trim().length > 0),
    hasPoints: Number.isFinite(question.points) && question.points > 0,
    hasRubric: question.rubric.length > 0,
    isParametric: Boolean(question.isParametric),
  };
}

export function validateHomeworkDraft(draft: HomeworkDraftState): DraftValidationSummary {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const questionSummaries = draft.questions.map(validateQuestion);

  if (!draft.metadata.title.trim()) {
    blockers.push("חסרה כותרת למטלה.");
  }

  if (!draft.metadata.courseId.trim()) {
    blockers.push("חסר קורס או שם קבוצה.");
  }

  if (!draft.metadata.availableFrom || !draft.metadata.availableUntil) {
    blockers.push("יש להגדיר חלון זמינות מלא עם זמן פתיחה וזמן סגירה.");
  } else if (!hasValidAvailabilityWindow(draft.metadata)) {
    blockers.push("חלון הזמינות אינו תקין. זמן הפתיחה חייב להיות לפני זמן הסגירה.");
  }

  const hasDataset = Boolean(draft.dataset.selectedDatasetId || draft.dataset.newDatasetName?.trim());
  if (!hasDataset) {
    blockers.push("יש לבחור מאגר נתונים או ליצור מאגר חדש לפני הפרסום.");
  }

  if (draft.questions.length === 0) {
    blockers.push("יש להוסיף לפחות שאלה אחת.");
  }

  questionSummaries.forEach((question) => {
    const label = `שאלה ${question.index + 1}`;
    if (!question.hasPrompt) {
      blockers.push(`${label}: חסר ניסוח משימה.`);
    }
    if (!question.hasExpectedOutput) {
      blockers.push(`${label}: חסר תיאור פלט צפוי.`);
    }
    if (!question.hasPoints) {
      blockers.push(`${label}: יש להגדיר ניקוד גדול מאפס.`);
    }
    if (!question.hasRubric) {
      warnings.push(`${label}: אין פריטי רובריקה.`);
    }
  });

  return {
    blockers,
    warnings,
    questionSummaries,
    canPublish: blockers.length === 0,
  };
}

export function resolveBuilderDashboardStatus(input: {
  visibility: string;
  published: boolean;
  availabilityState?: HomeworkAvailabilityState;
}): BuilderDashboardStatus {
  if (input.visibility === "archived") {
    return "archived";
  }

  if (!input.published || input.visibility === "draft") {
    return "draft";
  }

  if (input.availabilityState === "upcoming") {
    return "upcoming";
  }

  if (input.availabilityState === "closed") {
    return "closed";
  }

  return "open";
}
