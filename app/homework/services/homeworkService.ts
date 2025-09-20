import { http } from "./http";
import type {
  HomeworkQueryParams,
  HomeworkSet,
  HomeworkSummary,
  PaginatedResponse,
  Question,
  PublishGradesResult,
} from "../types";

const BASE_PATH = "/api/homework";

export async function listHomeworkSets(
  params?: HomeworkQueryParams & { page?: number; pageSize?: number },
): Promise<PaginatedResponse<HomeworkSummary>> {
  return http(`${BASE_PATH}`, {
    params: params as Record<string, string | number | boolean | undefined>,
    method: "GET",
  });
}

export async function getHomeworkSet(setId: string): Promise<HomeworkSet> {
  return http(`${BASE_PATH}/${setId}`, { method: "GET" });
}

export async function getHomeworkQuestions(setId: string): Promise<Question[]> {
  return http(`${BASE_PATH}/${setId}/questions`, { method: "GET" });
}

export interface UpsertQuestionPayload extends Partial<Question> {
  id?: string;
}

export async function upsertQuestion(setId: string, payload: UpsertQuestionPayload): Promise<Question> {
  return http(`${BASE_PATH}/${setId}/questions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface CreateHomeworkPayload extends Partial<HomeworkSet> {
  questions?: UpsertQuestionPayload[];
}

export async function createHomeworkSet(payload: CreateHomeworkPayload): Promise<HomeworkSet> {
  return http(`${BASE_PATH}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHomeworkSet(setId: string, payload: Partial<HomeworkSet>): Promise<HomeworkSet> {
  return http(`${BASE_PATH}/${setId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestion(setId: string, questionId: string): Promise<void> {
  await http(`${BASE_PATH}/${setId}/questions/${questionId}`, { method: "DELETE" });
}

export interface SaveHomeworkDraftPayload extends Partial<HomeworkSet> {
  questions?: Question[];
}

export async function saveHomeworkDraft(setId: string, payload: SaveHomeworkDraftPayload): Promise<HomeworkSet> {
  return http(`${BASE_PATH}/${setId}/draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishHomework(setId: string, published: boolean): Promise<HomeworkSet> {
  return http(`${BASE_PATH}/${setId}`, {
    method: "PATCH",
    body: JSON.stringify({ published }),
  });
}

export async function publishHomeworkGrades(setId: string): Promise<PublishGradesResult> {
  return http(`${BASE_PATH}/${setId}/publish-grades`, {
    method: "POST",
  });
}
