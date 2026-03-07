import type { HomeworkEntryMode } from "@/app/homework/types";

export interface HomeworkAvailabilityBackfillInput {
  dueAt?: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  createdAt?: string | null;
  entryMode?: HomeworkEntryMode | null;
}

export interface HomeworkAvailabilityBackfillResult {
  availableFrom: string;
  availableUntil: string;
  dueAt: string;
  entryMode: HomeworkEntryMode;
}

export function buildHomeworkAvailabilityBackfill(
  homework: HomeworkAvailabilityBackfillInput,
  nowIso: string,
): HomeworkAvailabilityBackfillResult {
  const availableFrom = homework.availableFrom || homework.createdAt || nowIso;
  const availableUntil = homework.availableUntil || homework.dueAt || nowIso;

  return {
    availableFrom,
    availableUntil,
    dueAt: homework.dueAt || availableUntil,
    entryMode: homework.entryMode || "listed",
  };
}

export function needsHomeworkAvailabilityBackfill(
  homework: HomeworkAvailabilityBackfillInput,
): boolean {
  return !homework.availableFrom || !homework.availableUntil || !homework.dueAt || !homework.entryMode;
}
