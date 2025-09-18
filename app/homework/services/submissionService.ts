import { http } from "./http";
import type { QuestionProgress, Submission, SubmissionSummary } from "../types";

const BASE_PATH = "/api/submissions";

export async function getSubmission(setId: string, studentId: string) {
  return http<Submission>(`${BASE_PATH}/${setId}`, {
    method: "GET",
    params: { studentId },
  });
}

export async function saveSubmissionDraft(
  setId: string,
  payload: Partial<Submission> & { studentId: string },
) {
  return http<Submission>(`${BASE_PATH}/${setId}/save-draft`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitHomework(setId: string, payload: { studentId: string }) {
  return http<Submission>(`${BASE_PATH}/${setId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function gradeSubmission(submissionId: string, payload: Partial<Submission>) {
  return http<Submission>(`${BASE_PATH}/by-id/${submissionId}/grade`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSubmissionSummaries(setId: string) {
  return http<SubmissionSummary[]>(`${BASE_PATH}/${setId}`, {
    method: "GET",
    params: { role: "builder" },
  });
}

export async function getSubmissionById(submissionId: string) {
  return http<Submission>(`${BASE_PATH}/by-id/${submissionId}`, { method: "GET" });
}

export async function getSubmissionProgress(setId: string, studentId: string) {
  return http<QuestionProgress[]>(`${BASE_PATH}/${setId}/progress`, {
    method: "GET",
    params: { studentId },
  });
}

export async function getSubmissionProgressById(submissionId: string) {
  return http<QuestionProgress[]>(`${BASE_PATH}/by-id/${submissionId}/progress`, {
    method: "GET",
  });
}
