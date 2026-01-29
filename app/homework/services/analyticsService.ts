import { http } from "./http";
import type { AnalyticsEvent, QuestionAnalyticsStats } from "../types";

export async function listAnalyticsEvents(setId: string) {
  return http<AnalyticsEvent[]>(`/api/analytics/homework/${setId}`, { method: "GET" });
}

export async function getQuestionAnalyticsStats(params: {
  setId?: string;
  questionId?: string;
  studentId?: string;
  from?: string;
  to?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.setId) searchParams.set("setId", params.setId);
  if (params.questionId) searchParams.set("questionId", params.questionId);
  if (params.studentId) searchParams.set("studentId", params.studentId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  const response = await http<{ stats: QuestionAnalyticsStats[] }>(
    `/api/analytics/question/stats?${searchParams.toString()}`,
    { method: "GET" }
  );

  return response.stats;
}
